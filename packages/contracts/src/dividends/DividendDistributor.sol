// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title DividendDistributor
/// @notice Snapshot-based, pull-payment dividends. The issuer snapshots the cap
///         table OFF-CHAIN (via the indexer), builds a Merkle tree of (holder, amount),
///         funds the contract, and posts the root. Holders claim with a proof.
/// @dev Leaf format matches OpenZeppelin StandardMerkleTree:
///      keccak256(bytes.concat(keccak256(abi.encode(account, amount)))).
contract DividendDistributor {
    IERC20 public immutable payoutToken;
    address public owner;

    struct Distribution {
        bytes32 merkleRoot;
        uint256 total;
        uint256 claimed;
    }
    /// @notice All distributions, indexed by id.
    Distribution[] public distributions;
    /// @notice Whether an account has claimed from a given distribution id.
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event DistributionCreated(
        uint256 indexed id,
        bytes32 merkleRoot,
        uint256 total
    );
    event DividendClaimed(
        uint256 indexed id,
        address indexed account,
        uint256 amount
    );

    /// @param _payoutToken ERC-20 used for payouts; the deployer becomes owner.

    constructor(address _payoutToken) {
        payoutToken = IERC20(_payoutToken);
        owner = msg.sender;
    }

    /// @notice Create a funded, Merkle-committed dividend distribution.
    /// @param merkleRoot Root of a StandardMerkleTree of (holder, amount) leaves.
    /// @param total Amount of payout token pulled from the caller to fund claims.
    /// @return id The new distribution's index.
    function createDistribution(
        bytes32 merkleRoot,
        uint256 total
    ) external returns (uint256 id) {
        require(msg.sender == owner, "not owner");
        require(
            payoutToken.transferFrom(msg.sender, address(this), total),
            "funding failed"
        );
        distributions.push(
            Distribution({merkleRoot: merkleRoot, total: total, claimed: 0})
        );
        id = distributions.length - 1;
        emit DistributionCreated(id, merkleRoot, total);
    }

    /// @notice Claim your pro-rata dividend for a distribution.
    /// @param id The distribution index.
    /// @param amount Your allocated amount (must match the Merkle leaf).
    /// @param proof Merkle proof for (msg.sender, amount).

    function claim(
        uint256 id,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        require(!hasClaimed[id][msg.sender], "already claimed");
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(msg.sender, amount)))
        );
        require(
            MerkleProof.verify(proof, distributions[id].merkleRoot, leaf),
            "invalid proof"
        );

        hasClaimed[id][msg.sender] = true;
        distributions[id].claimed += amount;
        require(payoutToken.transfer(msg.sender, amount), "payout failed");
        emit DividendClaimed(id, msg.sender, amount);
    }

    function distributionsCount() external view returns (uint256) {
        return distributions.length;
    }
}
