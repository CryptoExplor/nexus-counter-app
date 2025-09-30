// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title EvolvingNexusCounter v2
/// @notice Merges a counter + leaderboard with evolving on-chain badge NFTs (improved, safer)
contract EvolvingNexusCounter is ERC721, Ownable {
    // --- Configurable ---
    uint256 public fee; // fee (in wei) required to call counter actions
    uint256 public constant COOLDOWN_SECONDS = 1 hours; // cooldown for user actions
    uint256 public constant MAX_TOP = 20; // keep a bounded on-chain top-N leaderboard

    // --- Counter & leaderboard state ---
    uint256 public count;
    mapping(address => uint256) public incrementCount; // lifetime actions count
    mapping(address => bool) private seenInLeaderboard;

    // compact bounded top-N leaderboard (descending)
    address[] public topAddresses;
    uint256[] public topCounts;

    // --- Badge state ---
    uint256 private nextTokenId = 1;
    uint256 private constant INITIAL_TOKEN_ID = 1;

    struct UserStats {
        uint256 increments;
        uint256 decrements;
        uint256 lastActionTime;
        uint256 badgeTier;
    }

    mapping(address => UserStats) public userStats;
    mapping(address => uint256) public userTokenId;

    // thresholds (owner configurable)
    uint256 public bronzeThreshold = 10;
    uint256 public silverThreshold = 25;
    uint256 public goldThreshold = 50;
    uint256 public platinumThreshold = 100;
    uint256 public diamondThreshold = 250;
    uint256 public masterThreshold = 500;
    uint256 public legendaryThreshold = 1000;

    mapping(uint256 => string) public badgeNames;

    // Events
    event CounterChanged(address indexed user, int256 delta, uint256 newCount);
    event BadgeAssigned(address indexed user, uint256 tokenId, uint256 tier);
    event FeeUpdated(uint256 newFee);
    event BadgeThresholdsUpdated();
    event CounterReset(uint256 newValue);

    // --- Constructor ---
    // FIX: Pass msg.sender to the Ownable base constructor to resolve TypeError
    constructor(uint256 _initialFee) ERC721("EvolvingNexusBadge", "ENBADGE") Ownable(msg.sender) {
        fee = _initialFee;

        badgeNames[1] = "Bronze Counter Badge";
        badgeNames[2] = "Silver Counter Badge";
        badgeNames[3] = "Gold Counter Badge";
        badgeNames[4] = "Platinum Counter Badge";
        badgeNames[5] = "Diamond Counter Badge";
        badgeNames[6] = "Master Counter Badge";
        badgeNames[7] = "Legendary Counter Badge";
    }

    // --- Modifiers ---
    modifier onlyPaid() {
        require(msg.value == fee, "Must pay exact fee");
        _;
    }

    modifier timeLocked() {
        require(block.timestamp >= userStats[msg.sender].lastActionTime + COOLDOWN_SECONDS, "Action locked: wait");
        _;
        userStats[msg.sender].lastActionTime = block.timestamp;
    }

    // --- Public counter functions (single behavior) ---
    /// @notice increment counter (payable)
    function increment() external payable onlyPaid timeLocked {
        count += 1;
        incrementCount[msg.sender] += 1;

        // update leaderboard top-N
        _updateTopLeaderboard(msg.sender);

        // update badge stats & possibly mint/upgrade badge
        userStats[msg.sender].increments += 1;
        _assignOrUpdateBadge(msg.sender);

        // forward fee to owner
        // Note: The owner is the contract deployer (from Ownable)
        payable(owner()).transfer(msg.value);

        emit CounterChanged(msg.sender, 1, count);
    }

    /// @notice decrement counter (payable)
    function decrement() external payable onlyPaid timeLocked {
        require(count > 0, "Counter already zero");
        count -= 1;
        incrementCount[msg.sender] += 1;

        _updateTopLeaderboard(msg.sender);

        userStats[msg.sender].decrements += 1;
        _assignOrUpdateBadge(msg.sender);

        payable(owner()).transfer(msg.value);

        emit CounterChanged(msg.sender, -1, count);
    }

    // --- Owner/admin functions ---
    function setFee(uint256 _newFee) external onlyOwner {
        fee = _newFee;
        emit FeeUpdated(_newFee);
    }

    function resetCounter(uint256 _newValue) external onlyOwner {
        count = _newValue;
        emit CounterReset(_newValue);
    }

    function setBadgeThresholds(
        uint256 bronze,
        uint256 silver,
        uint256 gold,
        uint256 platinum,
        uint256 diamond,
        uint256 master,
        uint256 legendary
    ) external onlyOwner {
        bronzeThreshold = bronze;
        silverThreshold = silver;
        goldThreshold = gold;
        platinumThreshold = platinum;
        diamondThreshold = diamond;
        masterThreshold = master;
        legendaryThreshold = legendary;
        emit BadgeThresholdsUpdated();
    }

    // --- Top-N leaderboard maintenance (bounded, on-chain) ---
    /// @dev maintain topAddresses and topCounts in descending order
    function _updateTopLeaderboard(address user) internal {
        uint256 userCount = incrementCount[user];

        // 1. Check if user is already in the list
        for (uint256 i = 0; i < topAddresses.length; i++) {
            if (topAddresses[i] == user) {
                topCounts[i] = userCount;
                // Bubble up if score increased
                while (i > 0 && topCounts[i] > topCounts[i - 1]) {
                    (topCounts[i - 1], topCounts[i]) = (topCounts[i], topCounts[i - 1]);
                    (topAddresses[i - 1], topAddresses[i]) = (topAddresses[i], topAddresses[i - 1]);
                    i--;
                }
                return;
            }
        }

        // 2. User not present: try to insert

        // Case A: List is not full, append and bubble up
        if (topAddresses.length < MAX_TOP) {
            topAddresses.push(user);
            topCounts.push(userCount);
            uint256 j = topAddresses.length - 1;
            while (j > 0 && topCounts[j] > topCounts[j - 1]) {
                (topCounts[j - 1], topCounts[j]) = (topCounts[j], topCounts[j - 1]);
                (topAddresses[j - 1], topAddresses[j]) = (topAddresses[j], topAddresses[j - 1]);
                j--;
            }
            return;
        } 
        
        // Case B: List is full, check if user qualifies to replace the last spot
        else {
            // If user's count is not better than the worst score, ignore
            if (userCount <= topCounts[topCounts.length - 1]) return;
            
            // Replace the last element
            topAddresses[topAddresses.length - 1] = user;
            topCounts[topAddresses.length - 1] = userCount; // FIX: Corrected index here
            
            // Bubble up the new entry
            uint256 k = topAddresses.length - 1;
            while (k > 0 && topCounts[k] > topCounts[k - 1]) {
                (topCounts[k - 1], topCounts[k]) = (topCounts[k], topCounts[k - 1]);
                (topAddresses[k - 1], topAddresses[k]) = (topAddresses[k], topAddresses[k - 1]);
                k--;
            }
        }
    }

    // Top-N getters
    function getTopAddresses() external view returns (address[] memory) {
        return topAddresses;
    }

    function getTopCounts() external view returns (uint256[] memory) {
        return topCounts;
    }

    // --- Badge logic (sequential tokens, safe) ---
    function _determineTier(uint256 increments) internal view returns (uint256) {
        if (increments >= legendaryThreshold) return 7;
        if (increments >= masterThreshold) return 6;
        if (increments >= diamondThreshold) return 5;
        if (increments >= platinumThreshold) return 4;
        if (increments >= goldThreshold) return 3;
        if (increments >= silverThreshold) return 2;
        if (increments >= bronzeThreshold) return 1;
        return 0;
    }

    function _assignOrUpdateBadge(address user) internal {
        uint256 tier = _determineTier(userStats[user].increments);
        if (tier > userStats[user].badgeTier) {
            userStats[user].badgeTier = tier;
            if (userTokenId[user] == 0) {
                uint256 tokenId = nextTokenId;
                nextTokenId++;
                _safeMint(user, tokenId);
                userTokenId[user] = tokenId;
            }
            emit BadgeAssigned(user, userTokenId[user], tier);
        }
    }

    // --- ERC721 metadata (on-chain SVG) ---
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        // FIX: Replaced _exists(tokenId) with _ownerOf(tokenId) check for OpenZeppelin v5+ compatibility
        require(_ownerOf(tokenId) != address(0), "ERC721Metadata: nonexistent token"); 
        
        address ownerAddr = ownerOf(tokenId);
        UserStats memory stats = userStats[ownerAddr];
        uint256 tier = stats.badgeTier;
        string memory name = badgeNames[tier];
        string memory svg = _generateSVG(stats.increments, tier);
        string memory image = Base64.encode(bytes(svg));
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"',
                        name,
                        '","description":"Evolving On-chain Counter Badge NFT","attributes":[',
                        '{"trait_type":"Tier","value":"', name, '"},',
                        '{"trait_type":"Increments","value":"', Strings.toString(stats.increments), '"}',
                        '],"image":"data:image/svg+xml;base64,',
                        image,
                        '"}'
                    )
                )
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _generateSVG(uint256 increments, uint256 tier) internal pure returns (string memory) {
        string memory tierColor = _tierColor(tier);
        string memory tierText = _tierText(tier);
        return string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>",
                "<rect width='300' height='300' fill='", tierColor, "'/>",
                "<text x='50%' y='40%' dominant-baseline='middle' text-anchor='middle' font-size='24' fill='white'>", tierText, "</text>",
                "<text x='50%' y='60%' dominant-baseline='middle' text-anchor='middle' font-size='18' fill='white'>Increments: ", Strings.toString(increments), "</text>",
                "</svg>"
            )
        );
    }

    function _tierColor(uint256 tier) internal pure returns (string memory) {
        if (tier == 7) return "purple";
        if (tier == 6) return "blue";
        if (tier == 5) return "cyan";
        if (tier == 4) return "pink";
        if (tier == 3) return "gold";
        if (tier == 2) return "silver";
        if (tier == 1) return "bronze";
        return "gray";
    }

    function _tierText(uint256 tier) internal pure returns (string memory) {
        if (tier == 7) return "Legendary Badge";
        if (tier == 6) return "Master Badge";
        if (tier == 5) return "Diamond Badge";
        if (tier == 4) return "Platinum Badge";
        if (tier == 3) return "Gold Badge";
        if (tier == 2) return "Silver Badge";
        if (tier == 1) return "Bronze Badge";
        return "No Badge";
    }

    // --- Utility views ---
    function getUserStats(address user) external view returns (uint256 increments, uint256 decrements, uint256 lastAction, uint256 tier) {
        UserStats memory s = userStats[user];
        return (s.increments, s.decrements, s.lastActionTime, s.badgeTier);
    }
}
