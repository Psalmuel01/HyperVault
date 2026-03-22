// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
//  XCM Precompile Interface
//  Address on Polkadot Hub (Passet Hub testnet + mainnet):
//      0x00000000000000000000000000000000000a0000
//
//  Source: https://docs.polkadot.com/smart-contracts/precompiles/xcm/
// ─────────────────────────────────────────────────────────────

/**
 * @dev Represents an XCM VersionedLocation (previously MultiLocation).
 *      For Bifrost: parents=1, interior encodes X1(Parachain(2030)).
 *
 *      SCALE-encoded bytes for Bifrost destination (V5):
 *        parents  = 0x01
 *        interior = X1 tag (0x01) + Parachain tag (0x00) + compact<u32>(2030)
 *        compact<u32>(2030) = 0xB91F
 *        Full: 0x010100B91F
 *
 *      Wrapped as VersionedLocation V5:
 *        0x05 (V5) + 0x010100B91F
 *        = 0x05010100B91F
 */

/**
 * @notice XCM Weight struct used by weighMessage / execute.
 */
struct Weight {
    uint64 refTime;
    uint64 proofSize;
}

/**
 * @notice Minimal interface for the Polkadot Hub XCM precompile.
 *
 *  send()    – fire-and-forget cross-chain message (no fee deducted from
 *              caller; the origin must have enough native balance for XCM fees
 *              as configured in the runtime).
 *
 *  execute() – execute an XCM message locally (useful for testing MultiAsset
 *              transfers before sending cross-chain).
 *
 *  weighMessage() – dry-run weight estimation (read-only).
 */
interface IXcm {
    /**
     * @notice Send an XCM message to a destination chain.
     * @param dest     SCALE-encoded VersionedLocation of the destination.
     * @param message  SCALE-encoded VersionedXcm message body.
     */
    function send(bytes memory dest, bytes memory message) external;

    /**
     * @notice Execute an XCM message locally.
     * @param message    SCALE-encoded VersionedXcm message body.
     * @param maxWeight  Maximum weight to consume.
     */
    function execute(bytes memory message, Weight memory maxWeight) external;

    /**
     * @notice Estimate the weight of an XCM message (view, no state change).
     * @param message SCALE-encoded VersionedXcm message body.
     * @return weight Estimated Weight struct.
     */
    function weighMessage(bytes memory message)
        external
        view
        returns (Weight memory weight);
}
