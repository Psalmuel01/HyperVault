// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
//  HyperVault.sol
//
//  A Solidity-native yield vault on Polkadot Hub that:
//    1. Accepts canonical hub token deposits (native PAS/DOT), with
//       optional ERC-20 mode for testing and compatibility
//    2. Sends DOT to Bifrost (parachain 2030) via XCM to mint vDOT
//    3. Tracks each user's proportional share of the vault
//    4. On withdrawal, dispatches XCM to Bifrost to redeem vDOT → DOT
//    5. Returns principal + accrued staking yield to the user
//
//  Network:  Passet Hub (Polkadot Hub TestNet)
//  RPC:      https://testnet-passet-hub-eth-rpc.polkadot.io
//  ChainId:  420420417
//
//  Key addresses (Passet Hub):
//    XCM precompile:  0x00000000000000000000000000000000000a0000
//    DOT ERC-20:      Set via constructor (check Polkadot Hub docs for
//                     the ERC-20 precompile address of the native DOT asset)
//
//  Bifrost:
//    Parachain ID: 2030
//    XCM Dest:     { parents: 1, interior: X1(Parachain(2030)) }
//
//  ── Fallback mode ───────────────────────────────────────────
//  If the XCM precompile is unreachable or the SLPx call bytes
//  are not yet known, the vault operates in MOCK mode:
//    • All accounting (shares, balances) is real and on-chain
//    • XCM dispatch is replaced with emitted events
//    • A mock APY (15%) accrues per-second for demo purposes
//  Toggle via `xcmEnabled` flag (owner-only).
// ─────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IXcm.sol";
import "./interfaces/BuildCallData.sol";
import "./interfaces/XcmBuilder.sol";

contract HyperVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────────────────

    /// @notice XCM precompile – fixed address on Polkadot Hub.
    address public constant XCM_PRECOMPILE =
        0x00000000000000000000000000000000000a0000;

    /// @notice Bifrost parachain ID.
    uint32 public constant BIFROST_PARA_ID = 2030;

    /// @notice Basis points denominator (10 000 = 100%).
    uint256 public constant BPS = 10_000;

    /// @notice Initial share price: 1 DOT = 1e18 shares (like an ERC-4626 vault).
    uint256 public constant INITIAL_SHARE_PRICE = 1e18;

    /// @notice Mock APY in basis points (1500 = 15%). Used in fallback mode.
    uint256 public constant MOCK_APY_BPS = 1500;

    /// @notice Seconds in a year (approximate).
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ─────────────────────────────────────────────────────────
    //  Immutables
    // ─────────────────────────────────────────────────────────

    /// @notice DOT/PAS token address in ERC-20 mode (zero in native mode).
    IERC20 public immutable dotToken;

    /// @notice True when deposits use chain-native asset via msg.value.
    bool public immutable nativeDotMode;

    /// @notice DOT decimals (used for share math).
    uint8 public immutable dotDecimals;

    /// @notice Sovereign account of this vault on Bifrost (used in XCM messages).
    ///         Computed off-chain from the vault's Polkadot Hub address and
    ///         passed in at deploy time.
    bytes32 public hubSovereign;

    // ─────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────

    /// @notice Total shares ever minted (not burned).
    uint256 public totalShares;

    /// @notice Total DOT deposited and currently tracked by the vault.
    ///         In live XCM mode this represents the DOT locked on Bifrost.
    ///         In mock mode it's the literal DOT held by the contract.
    uint256 public totalDotDeposited;

    /// @notice Accumulated mock yield in DOT base units – only meaningful in mock mode.
    uint256 public mockAccruedYield;

    /// @notice Timestamp of the last mock yield accrual.
    uint256 public lastYieldTimestamp;

    /// @notice Per-user share balance.
    mapping(address => uint256) public shares;

    /// @notice Timestamp at which the user last deposited (for yield display).
    mapping(address => uint256) public depositTimestamp;

    /// @notice Expected DOT to return once redeem completes.
    mapping(address => uint256) public pendingWithdrawal;

    /// @notice Vault DOT balance snapshot before dispatching redeem.
    mapping(address => uint256) public pendingWithdrawalBalanceStart;

    /// @notice Running count of unique depositors.
    uint256 public depositorCount;
    mapping(address => bool) private _hasDeposited;

    // ── XCM configuration ────────────────────────────────────

    /// @notice Whether to actually dispatch XCM messages or just emit events.
    bool public xcmEnabled;

    // ---------------------------------------------------------------------
    // Live XCM -> Bifrost SLPx create_order configuration
    // ---------------------------------------------------------------------

    /// @notice Bifrost currency id for DOT (bytes2).
    bytes2 public dotCurrencyId;

    /// @notice Bifrost currency id for vDOT (bytes2).
    bytes2 public vDotCurrencyId;

    /// @notice Raw destination chain marker used to build `targetChain`.
    ///         (First byte of `abi.encodePacked(destChainIndexRaw, receiver)`.)
    bytes1 public destChainIndexRaw;

    /// @notice Order remark encoded by BuildCallData (letters/digits only).
    string public remark;

    /// @notice Reward sharing channel id.
    uint32 public channelId;

    /// @notice Weight parameters for Bifrost Transact (tune after testing).
    uint64 public xcmRefTime   = 5_000_000_000;
    uint64 public xcmProofSize = 131_072;

    // ─────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────

    event Deposited(
        address indexed user,
        uint256 dotAmount,
        uint256 sharesIssued,
        uint256 sharePrice
    );

    event WithdrawalInitiated(
        address indexed user,
        uint256 sharesBurned,
        uint256 dotEstimate
    );

    event WithdrawalCompleted(
        address indexed user,
        uint256 dotReturned,
        uint256 yieldEarned
    );

    event XcmDispatched(
        address indexed user,
        string  action,         // "mint" | "redeem"
        uint256 dotAmount,
        bool    live            // true = real XCM, false = mock
    );

    event MockYieldAccrued(uint256 yieldAdded, uint256 newTotalDot);

    event XcmConfigUpdated(
        bytes2 dotCurrencyId,
        bytes2 vDotCurrencyId,
        bytes1 destChainIndexRaw,
        string remark,
        uint32 channelId,
        bool enabled
    );

    event HubSovereignUpdated(bytes32 hubSovereign);

    // ─────────────────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────────────────

    error ZeroAmount();
    error InvalidSovereign();
    error InsufficientShares(uint256 requested, uint256 available);
    error NothingToWithdraw();
    error TransferFailed();
    error XcmCallFailed();
    error VaultPaused();
    error XcmNotConfigured();
    error InvalidNativeDeposit(uint256 expected, uint256 actual);
    error UnexpectedNativeValue(uint256 actual);

    // ─────────────────────────────────────────────────────────
    //  Pause
    // ─────────────────────────────────────────────────────────

    bool public paused;

    modifier whenNotPaused() {
        if (paused) revert VaultPaused();
        _;
    }

    // ─────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────

    /**
     * @param _dotToken     Address of DOT/PAS ERC-20 token in ERC-20 mode.
     *                      Set to address(0) to use canonical native mode.
     * @param _hubSovereign 32-byte sovereign account of this contract on Bifrost.
     * @param _xcmEnabled   Start in live XCM mode (true) or mock mode (false).
     */
    constructor(
        address _dotToken,
        bytes32 _hubSovereign,
        bool    _xcmEnabled
    ) Ownable(msg.sender) {
        dotToken      = IERC20(_dotToken);
        nativeDotMode = _dotToken == address(0);
        dotDecimals   = nativeDotMode ? 10 : _safeReadDecimals(_dotToken);
        hubSovereign  = _hubSovereign;
        xcmEnabled    = _xcmEnabled;
        lastYieldTimestamp = block.timestamp;
    }

    // ─────────────────────────────────────────────────────────
    //  Core: Deposit
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Deposit DOT into the vault.
     *         Mints proportional shares. If XCM is enabled, dispatches a
     *         mint message to Bifrost so the DOT is staked for vDOT yield.
     *
     * @param amount Amount of DOT in the DOT token's base units (ERC-20 smallest unit).
     */
    function deposit(uint256 amount) external payable nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        // Accrue mock yield before changing balances (keeps share price fresh).
        _accrueMockYield();

        // Pull DOT/PAS from caller.
        _pullDotFromSender(amount);

        // ── Share calculation (ERC-4626 style) ───────────────
        // First depositor: 1 DOT (10^decimals) = INITIAL_SHARE_PRICE shares.
        // Subsequent depositors: proportional to current vault value.
        uint256 issued;
        if (totalShares == 0 || totalDotDeposited == 0) {
            uint256 scale = 10 ** uint256(dotDecimals);
            // Seed: 1 DOT (10^decimals) = INITIAL_SHARE_PRICE shares
            issued = (amount * INITIAL_SHARE_PRICE) / scale;
        } else {
            issued = (amount * totalShares) / _totalVaultDot();
        }

        shares[msg.sender]      += issued;
        totalShares             += issued;
        totalDotDeposited       += amount;

        if (!_hasDeposited[msg.sender]) {
            _hasDeposited[msg.sender] = true;
            depositorCount++;
        }
        depositTimestamp[msg.sender] = block.timestamp;

        emit Deposited(msg.sender, amount, issued, currentSharePrice());

        // ── XCM dispatch ─────────────────────────────────────
        _dispatchMint(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────
    //  Core: Withdraw
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Initiate withdrawal by burning `shareAmount` shares.
     *         In live XCM mode: dispatches a redeem message to Bifrost;
     *         the DOT + yield arrives asynchronously (call completeWithdraw).
     *         In mock mode: transfers DOT + simulated yield immediately.
     *
     * @param shareAmount Number of vault shares to redeem.
     */
    function withdraw(uint256 shareAmount) external nonReentrant whenNotPaused {
        if (shareAmount == 0) revert ZeroAmount();
        if (shares[msg.sender] < shareAmount)
            revert InsufficientShares(shareAmount, shares[msg.sender]);

        _accrueMockYield();

        // Calculate DOT owed for these shares.
        uint256 dotOwed = (shareAmount * _totalVaultDot()) / totalShares;

        // Burn shares.
        shares[msg.sender] -= shareAmount;
        totalShares        -= shareAmount;
        totalDotDeposited   = totalDotDeposited > dotOwed
            ? totalDotDeposited - dotOwed
            : 0;

        emit WithdrawalInitiated(msg.sender, shareAmount, dotOwed);

        if (!xcmEnabled) {
            // ── Mock mode: instant settlement ────────────────
            _settleMockWithdrawal(msg.sender, dotOwed);
        } else {
            // ── Live mode: async via XCM ──────────────────────
            require(pendingWithdrawal[msg.sender] == 0, "pending withdrawal exists");
            pendingWithdrawal[msg.sender] = dotOwed;
            pendingWithdrawalBalanceStart[msg.sender] = _vaultDotBalance();
            _dispatchRedeem(msg.sender, dotOwed);
        }
    }

    /**
     * @notice Complete a pending withdrawal after XCM redeem has settled.
     *         In mock mode this is never needed (withdraw() is instant).
     *         In live mode the owner (or a keeper) calls this once Bifrost
     *         has confirmed the redemption and DOT has arrived back.
     *
     * @param user Address to settle.
     */
    function completeWithdrawal(address user)
        external
        onlyOwner
        nonReentrant
    {
        uint256 expected = pendingWithdrawal[user];
        if (expected == 0) revert NothingToWithdraw();

        uint256 startBal = pendingWithdrawalBalanceStart[user];

        pendingWithdrawal[user] = 0;
        pendingWithdrawalBalanceStart[user] = 0;

        uint256 currentBal = _vaultDotBalance();
        if (currentBal < startBal) revert TransferFailed();

        uint256 actual = currentBal - startBal;
        require(actual > 0, "Redeem returned 0 DOT");

        // Withdraw() reduced `totalDotDeposited` by expected. Adjust to actual.
        if (actual > expected) {
            uint256 extra = actual - expected;
            totalDotDeposited = totalDotDeposited > extra ? totalDotDeposited - extra : 0;
        } else if (expected > actual) {
            uint256 refund = expected - actual;
            totalDotDeposited += refund;
        }

        _pushDot(user, actual);
        uint256 yieldEarned = actual > expected ? actual - expected : 0;
        emit WithdrawalCompleted(user, actual, yieldEarned);
    }

    /**
     * @notice Permissionless claim path for users in live XCM mode.
     *         If enough DOT has arrived back to the vault, user can claim
     *         the amount estimated at withdraw-initiation.
     */
    function claimWithdrawal() external nonReentrant {
        uint256 expected = pendingWithdrawal[msg.sender];
        if (expected == 0) revert NothingToWithdraw();

        uint256 available = _vaultDotBalance();
        require(available >= expected, "redeem pending");

        pendingWithdrawal[msg.sender] = 0;
        pendingWithdrawalBalanceStart[msg.sender] = 0;

        _pushDot(msg.sender, expected);
        emit WithdrawalCompleted(msg.sender, expected, 0);
    }

    // ─────────────────────────────────────────────────────────
    //  Internal: XCM dispatch
    // ─────────────────────────────────────────────────────────

    function _dispatchMint(address user, uint256 dotAmount) internal {
        if (!xcmEnabled) {
            // Mock mode – just emit.
            emit XcmDispatched(user, "mint", dotAmount, false);
            return;
        }
        if (!_isLiveXcmConfigured()) revert XcmNotConfigured();

        bytes memory dest    = XcmBuilder.bifrostDest();
        bytes memory targetChain = abi.encodePacked(destChainIndexRaw, address(this));
        bytes memory mintCall = BuildCallData.buildCreateOrderCallBytes(
            address(this),
            block.chainid,
            block.number,
            dotCurrencyId,
            uint128(dotAmount),
            targetChain,
            remark,
            channelId
        );
        bytes memory message = XcmBuilder.buildMintMessage(
            uint128(dotAmount),
            hubSovereign,
            mintCall,
            xcmRefTime,
            xcmProofSize
        );

        bool ok = IXcm(XCM_PRECOMPILE).send(dest, message);
        if (!ok) revert XcmCallFailed();

        emit XcmDispatched(user, "mint", dotAmount, true);
    }

    function _dispatchRedeem(address user, uint256 dotAmount) internal {
        if (!xcmEnabled) {
            emit XcmDispatched(user, "redeem", dotAmount, false);
            return;
        }
        if (!_isLiveXcmConfigured()) revert XcmNotConfigured();

        bytes memory dest    = XcmBuilder.bifrostDest();
        bytes memory targetChain = abi.encodePacked(destChainIndexRaw, address(this));
        bytes memory redeemCall = BuildCallData.buildCreateOrderCallBytes(
            address(this),
            block.chainid,
            block.number,
            vDotCurrencyId,
            uint128(dotAmount),
            targetChain,
            remark,
            channelId
        );
        bytes memory message = XcmBuilder.buildRedeemMessage(
            uint128(dotAmount),
            hubSovereign,
            redeemCall,
            xcmRefTime,
            xcmProofSize
        );

        bool ok = IXcm(XCM_PRECOMPILE).send(dest, message);
        if (!ok) revert XcmCallFailed();

        emit XcmDispatched(user, "redeem", dotAmount, true);
    }

    // ─────────────────────────────────────────────────────────
    //  Internal: Mock yield accrual
    // ─────────────────────────────────────────────────────────

    /**
     * @dev Accrue mock yield linearly since last checkpoint.
     *      yield = principal * APY * elapsed / SECONDS_PER_YEAR
     *      Only active in mock mode (xcmEnabled = false OR no call bytes set).
     */
    function _accrueMockYield() internal {
        if (_isLiveXcmConfigured()) return; // live mode (XCM dispatch configured)
        if (totalDotDeposited == 0) {
            lastYieldTimestamp = block.timestamp;
            return;
        }

        uint256 elapsed = block.timestamp - lastYieldTimestamp;
        if (elapsed == 0) return;

        uint256 yield = (totalDotDeposited * MOCK_APY_BPS * elapsed)
            / (BPS * SECONDS_PER_YEAR);

        mockAccruedYield   += yield;
        lastYieldTimestamp  = block.timestamp;

        emit MockYieldAccrued(yield, _totalVaultDot());
    }

    function _settleMockWithdrawal(address user, uint256 dotOwed) internal {
        // In mock mode the contract holds the DOT; transfer directly.
        uint256 available = _vaultDotBalance();
        uint256 toSend    = dotOwed > available ? available : dotOwed;

        uint256 userDeposit = depositTimestamp[user] > 0
            ? _estimateUserYield(user)
            : 0;

        _pushDot(user, toSend);
        emit WithdrawalCompleted(user, toSend, userDeposit);
    }

    // ─────────────────────────────────────────────────────────
    //  View functions
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Current share price in DOT base units per share (scaled 1e18).
     *         Increases as yield accrues (mock mode).
     */
    function currentSharePrice() public view returns (uint256) {
        if (totalShares == 0) return INITIAL_SHARE_PRICE;
        return (_totalVaultDot() * 1e18) / totalShares;
    }

    /**
     * @notice Estimated DOT value of a user's position right now.
     */
    function getUserPositionDot(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[user] * _totalVaultDot()) / totalShares;
    }

    /**
     * @notice Estimated yield earned by a user since deposit (rough, view-only).
     */
    function getEstimatedYield(address user) external view returns (uint256) {
        return _estimateUserYield(user);
    }

    /**
     * @notice Full vault snapshot for the frontend.
     */
    function getVaultState() external view returns (
        uint256 _totalDotDeposited,
        uint256 _totalShares,
        uint256 _sharePrice,
        uint256 _mockAccruedYield,
        uint256 _depositorCount,
        bool    _xcmEnabled,
        bool    _paused
    ) {
        return (
            totalDotDeposited,
            totalShares,
            currentSharePrice(),
            mockAccruedYield,
            depositorCount,
            xcmEnabled,
            paused
        );
    }

    /**
     * @notice User-specific snapshot for the frontend.
     */
    function getUserInfo(address user) external view returns (
        uint256 _shares,
        uint256 _dotValue,
        uint256 _estimatedYield,
        uint256 _depositedAt,
        uint256 _pendingWithdrawal
    ) {
        uint256 dotValue = totalShares == 0
            ? 0
            : (shares[user] * _totalVaultDot()) / totalShares;

        return (
            shares[user],
            dotValue,
            _estimateUserYield(user),
            depositTimestamp[user],
            pendingWithdrawal[user]
        );
    }

    // ─────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────

    /// @dev Total vault DOT including mock accrued yield.
    function _totalVaultDot() internal view returns (uint256) {
        if (_isLiveXcmConfigured()) {
            return totalDotDeposited;
        }
        return totalDotDeposited + mockAccruedYield;
    }

    /// @dev Rough per-user yield estimate (pro-rata share of total mock yield).
    function _estimateUserYield(address user) internal view returns (uint256) {
        if (totalShares == 0 || shares[user] == 0) return 0;
        if (_isLiveXcmConfigured()) return 0;

        // Accrue virtually (without writing state) for view accuracy.
        uint256 elapsed   = block.timestamp - lastYieldTimestamp;
        uint256 pendYield = (totalDotDeposited * MOCK_APY_BPS * elapsed)
            / (BPS * SECONDS_PER_YEAR);

        uint256 totalYield = mockAccruedYield + pendYield;
        return (totalYield * shares[user]) / totalShares;
    }

    // ─────────────────────────────────────────────────────────
    //  Owner configuration
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Configure live XCM -> Bifrost SLPx `create_order`.
     *
     * @param _dotCurrencyId   Bifrost currency id for DOT (bytes2)
     * @param _vDotCurrencyId  Bifrost currency id for vDOT (bytes2)
     * @param _destChainIndexRaw Raw destination chain marker used by targetChain encoding (bytes1)
     * @param _remark          Order remark (letters/digits only)
     * @param _channelId       Reward sharing channel id
     * @param _enabled         Toggle live XCM dispatch
     */
    function setXcmConfig(
        bytes2 _dotCurrencyId,
        bytes2 _vDotCurrencyId,
        bytes1 _destChainIndexRaw,
        string calldata _remark,
        uint32 _channelId,
        bool _enabled
    ) external onlyOwner {
        if (_enabled) {
            require(_dotCurrencyId != bytes2(0), "dotCurrencyId=0");
            require(_vDotCurrencyId != bytes2(0), "vDotCurrencyId=0");
            require(_destChainIndexRaw != bytes1(0), "destChainIndexRaw=0");
            require(bytes(_remark).length > 0, "remark empty");
        }

        dotCurrencyId = _dotCurrencyId;
        vDotCurrencyId = _vDotCurrencyId;
        destChainIndexRaw = _destChainIndexRaw;
        remark = _remark;
        channelId = _channelId;
        xcmEnabled = _enabled;
        if (_enabled) {
            // Reset demo-only accrual when switching to live mode so share
            // accounting is not inflated by synthetic yield.
            mockAccruedYield = 0;
            lastYieldTimestamp = block.timestamp;
        }

        emit XcmConfigUpdated(
            _dotCurrencyId,
            _vDotCurrencyId,
            _destChainIndexRaw,
            _remark,
            _channelId,
            _enabled
        );
    }

    /**
     * @notice Update XCM weight parameters (tune based on Bifrost benchmarks).
     */
    function setXcmWeights(uint64 _refTime, uint64 _proofSize)
        external
        onlyOwner
    {
        xcmRefTime   = _refTime;
        xcmProofSize = _proofSize;
    }

    /**
     * @notice Update the Hub sovereign account used for XCM beneficiary paths.
     */
    function setHubSovereign(bytes32 _hubSovereign) external onlyOwner {
        if (_hubSovereign == bytes32(0)) revert InvalidSovereign();
        hubSovereign = _hubSovereign;
        emit HubSovereignUpdated(_hubSovereign);
    }

    /**
     * @notice Emergency pause / unpause.
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @notice Emergency DOT rescue (only when paused).
     */
    function rescueDot(address to, uint256 amount) external onlyOwner {
        require(paused, "Unpause first");
        _pushDot(to, amount);
    }

    receive() external payable {}

    function _pullDotFromSender(uint256 amount) internal {
        if (nativeDotMode) {
            if (msg.value != amount) {
                revert InvalidNativeDeposit(amount, msg.value);
            }
            return;
        }

        if (msg.value != 0) revert UnexpectedNativeValue(msg.value);
        dotToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _pushDot(address to, uint256 amount) internal {
        if (nativeDotMode) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }
        dotToken.safeTransfer(to, amount);
    }

    function _vaultDotBalance() internal view returns (uint256) {
        if (nativeDotMode) return address(this).balance;
        return dotToken.balanceOf(address(this));
    }

    function _safeReadDecimals(address token) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            // Polkadot Hub ERC20 precompiles do not expose decimals/name/symbol.
            // DOT/PAS assets use 10 decimals on Hub.
            return 10;
        }
    }

    function _isLiveXcmConfigured() internal view returns (bool) {
        return
            xcmEnabled &&
            dotCurrencyId != bytes2(0) &&
            vDotCurrencyId != bytes2(0) &&
            destChainIndexRaw != bytes1(0) &&
            bytes(remark).length > 0;
    }
}
