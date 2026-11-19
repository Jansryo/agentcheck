// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AgentCheck — Daily check-in dApp for Binance Agent ID holders
/// @author AgentCheck (Binance Agent ID Hackathon)
/// @notice Only addresses holding at least one Agent ID NFT (ERC-721,
///         non-transferable) may check in, once per UTC day. Each check-in
///         extends the consecutive-day streak; missing a day resets it.
/// @dev Day = block.timestamp / 86400 (UTC day number, same convention as
///      Unix days). No funds are ever held or moved by this contract.

interface IAgentId {
    function balanceOf(address owner) external view returns (uint256);
}

contract AgentCheck {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Caller holds no Agent ID.
    error NotAgentIdHolder();
    /// @notice Caller already checked in today (UTC).
    error AlreadyCheckedIn();
    /// @notice Contract is paused (emergency only).
    error Paused();
    /// @notice Caller is not the owner.
    error NotOwner();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted on every successful check-in.
    /// @param user The address that checked in.
    /// @param day The UTC day number (block.timestamp / 86400).
    /// @param streak The user's current consecutive-day streak after this check-in.
    /// @param total The user's total lifetime check-ins after this check-in.
    event CheckIn(address indexed user, uint256 day, uint256 streak, uint256 total);

    /// @notice Emitted when the owner pauses or unpauses the contract.
    event PauseChanged(bool paused);

    /*//////////////////////////////////////////////////////////////
                            IMMUTABLE / STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice The Agent ID ERC-721 contract used as the holder gate.
    IAgentId public immutable agentId;

    /// @notice Contract owner (deployer). Can ONLY pause/unpause.
    address public immutable owner;

    /// @notice Emergency pause flag. When true, checkIn() reverts.
    bool public paused;

    /// @notice Last UTC day number a user checked in on (0 = never).
    mapping(address => uint256) public lastCheckInDay;
    /// @notice Current consecutive-day streak per user.
    mapping(address => uint256) public currentStreak;
    /// @notice Total lifetime check-ins per user.
    mapping(address => uint256) public totalCheckIns;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param _agentId Address of the Agent ID ERC-721 contract.
    constructor(address _agentId) {
        agentId = IAgentId(_agentId);
        owner = msg.sender;
    }

    /*//////////////////////////////////////////////////////////////
                           CORE: DAILY CHECK-IN
    //////////////////////////////////////////////////////////////*/

    /// @notice Check in for today (UTC). Requires holding >= 1 Agent ID.
    ///         One check-in per address per UTC day. Streak +1 if yesterday
    ///         was also checked in, otherwise resets to 1.
    function checkIn() external {
        if (paused) revert Paused();
        if (agentId.balanceOf(msg.sender) == 0) revert NotAgentIdHolder();

        uint256 day = block.timestamp / 86400;
        if (lastCheckInDay[msg.sender] == day) revert AlreadyCheckedIn();

        uint256 streak = (lastCheckInDay[msg.sender] == day - 1)
            ? currentStreak[msg.sender] + 1
            : 1;

        lastCheckInDay[msg.sender] = day;
        currentStreak[msg.sender] = streak;
        totalCheckIns[msg.sender] += 1;

        emit CheckIn(msg.sender, day, streak, totalCheckIns[msg.sender]);
    }

    /*//////////////////////////////////////////////////////////////
                            EMERGENCY PAUSE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause check-ins (emergency only). Does NOT touch user state.
    function pause() external {
        if (msg.sender != owner) revert NotOwner();
        paused = true;
        emit PauseChanged(true);
    }

    /// @notice Resume check-ins.
    function unpause() external {
        if (msg.sender != owner) revert NotOwner();
        paused = false;
        emit PauseChanged(false);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Whether `user` can check in today (UTC): holder, not yet
    ///         checked in today, and contract not paused.
    function canCheckInToday(address user) external view returns (bool) {
        if (paused) return false;
        if (agentId.balanceOf(user) == 0) return false;
        return lastCheckInDay[user] != block.timestamp / 86400;
    }

    /// @notice Current streak of `user`.
    function getStreak(address user) external view returns (uint256) {
        return currentStreak[user];
    }

    /// @notice Total lifetime check-ins of `user`.
    function getTotal(address user) external view returns (uint256) {
        return totalCheckIns[user];
    }

    /// @notice Last UTC day `user` checked in on (0 = never).
    function getLastDay(address user) external view returns (uint256) {
        return lastCheckInDay[user];
    }

    /// @notice All user info in one call:
    ///         (streak, total, lastDay, canCheckInToday).
    function getInfo(address user)
        external
        view
        returns (uint256 streak, uint256 total, uint256 lastDay, bool canCheckIn)
    {
        streak = currentStreak[user];
        total = totalCheckIns[user];
        lastDay = lastCheckInDay[user];
        canCheckIn = !paused &&
            agentId.balanceOf(user) > 0 &&
            lastDay != block.timestamp / 86400;
    }
}
