// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
//  XcmBuilder – helpers that produce SCALE-encoded XCM bytes
//  ready to pass into IXcm.send() on Polkadot Hub.
//
//  Encoding notes:
//    • Runtime requires XCM V5.
//    • Destination para id must use SCALE compact-u32.
//    • Asset id for relay token on Asset Hub is Location { parents:1, Here }.
// ─────────────────────────────────────────────────────────────

library XcmBuilder {
    // ── Constants ────────────────────────────────────────────

    /// @dev SCALE-encoded VersionedLocation V5 for Bifrost (paraId 2030).
    ///      0x05 | parents=1 | X1(Parachain(2030 compact))
    bytes internal constant BIFROST_DEST = hex"05010100B91F";

    /// @dev XCM V5 asset id bytes for relay native asset on Asset Hub:
    ///      Location { parents: 1, interior: Here }.
    bytes internal constant RELAY_HERE_ASSET_ID = hex"010000";

    // ── Destination builder ───────────────────────────────────

    function bifrostDest() internal pure returns (bytes memory) {
        return BIFROST_DEST;
    }

    // ── SCALE compact integer encoding ───────────────────────

    function compactU128(uint128 v) internal pure returns (bytes memory out) {
        if (v < 64) {
            out = new bytes(1);
            out[0] = bytes1(uint8(v << 2));
        } else if (v < 16384) {
            out = new bytes(2);
            uint16 enc = uint16((v << 2) | 1);
            out[0] = bytes1(uint8(enc));
            out[1] = bytes1(uint8(enc >> 8));
        } else if (v < 1073741824) {
            out = new bytes(4);
            uint32 enc = uint32((v << 2) | 2);
            out[0] = bytes1(uint8(enc));
            out[1] = bytes1(uint8(enc >> 8));
            out[2] = bytes1(uint8(enc >> 16));
            out[3] = bytes1(uint8(enc >> 24));
        } else {
            uint8 n = 0;
            uint128 tmp = v;
            while (tmp > 0) {
                tmp >>= 8;
                n++;
            }
            out = new bytes(1 + n);
            out[0] = bytes1(uint8(((n - 4) << 2) | 3));
            for (uint8 i = 0; i < n; i++) {
                out[1 + i] = bytes1(uint8(v >> (8 * i)));
            }
        }
    }

    // ── XCM message builders ──────────────────────────────────

    function buildMintMessage(
        uint128 dotAmount,
        bytes32 hubSovereign,
        bytes memory mintCall,
        uint64 refTime,
        uint64 proofSize
    ) internal pure returns (bytes memory) {
        // 1) WithdrawAsset
        bytes memory withdrawAsset = abi.encodePacked(
            hex"00", // WithdrawAsset
            hex"04", // vec len = 1
            RELAY_HERE_ASSET_ID,
            compactU128(dotAmount)
        );

        // 2) BuyExecution
        bytes memory buyExecution = abi.encodePacked(
            hex"13", // BuyExecution (V5 index)
            RELAY_HERE_ASSET_ID,
            compactU128(dotAmount),
            hex"00"  // WeightLimit::Unlimited
        );

        // 3) Transact
        // Call field is Binary, which itself is SCALE-bytes.
        bytes memory callBinary = _encodeBytes(mintCall);
        bytes memory transact = abi.encodePacked(
            hex"06", // Transact
            hex"01", // OriginKind::SovereignAccount
            hex"00", // fallback_max_weight = None
            _encodeBytes(callBinary)
        );

        // 4) RefundSurplus
        bytes memory refundSurplus = hex"14";

        // 5) DepositAsset (wild all-of relay fungible) back to beneficiary AccountId32.
        bytes memory depositAsset = abi.encodePacked(
            hex"0D",         // DepositAsset
            hex"010101000000", // AssetFilter::Wild(AllOf(id=relay-here, fun=Fungible))
            hex"01010000",   // beneficiary Location { parents:0, interior:X1(AccountId32(network=Any)) }
            hubSovereign
        );

        bytes memory instructions = abi.encodePacked(
            withdrawAsset,
            buyExecution,
            transact,
            refundSurplus,
            depositAsset
        );

        // V5 + vec len 5
        refTime; proofSize; // reserved for future weight tuning path
        return abi.encodePacked(hex"05", hex"14", instructions);
    }

    function buildRedeemMessage(
        uint128 vdotAmount,
        bytes32 hubSovereign,
        bytes memory redeemCall,
        uint64 refTime,
        uint64 proofSize
    ) internal pure returns (bytes memory) {
        bytes memory buyExecution = abi.encodePacked(
            hex"13",
            RELAY_HERE_ASSET_ID,
            compactU128(vdotAmount / 100),
            hex"00"
        );

        bytes memory callBinary = _encodeBytes(redeemCall);
        bytes memory transact = abi.encodePacked(
            hex"06",
            hex"01",
            hex"00",
            _encodeBytes(callBinary)
        );

        bytes memory refundSurplus = hex"14";
        bytes memory instructions = abi.encodePacked(buyExecution, transact, refundSurplus);

        hubSovereign; refTime; proofSize; // reserved for future path
        return abi.encodePacked(hex"05", hex"0C", instructions);
    }

    // ── Internal helpers ─────────────────────────────────────

    function _encodeBytes(bytes memory data)
        private
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(compactU128(uint128(data.length)), data);
    }
}
