// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";

contract IdentityClaimTest is Test {
    // ---- ERC-734 key constants ----
    uint256 constant MANAGEMENT_PURPOSE = 1;
    uint256 constant CLAIM_PURPOSE = 3;
    uint256 constant ECDSA_KEY_TYPE = 1;

    // ---- claim constants ----
    uint256 constant TOPIC_KYC = 1; // our convention: topic 1 = KYC
    uint256 constant SCHEME_ECDSA = 1; // ERC-735 signature scheme

    ClaimIssuer issuer;
    Identity investorId;

    // Actors (with known private keys so we can sign)
    uint256 issuerPk = 0xA11CE;
    address issuerAddr = vm.addr(0xA11CE);

    uint256 investorPk = 0xB0B;
    address investorAddr = vm.addr(0xB0B);

    uint256 attackerPk = 0xBAD;
    address attackerAddr = vm.addr(0xBAD);

    bytes claimData = abi.encode("PASSED_KYC");

    function setUp() public {
        // ClaimIssuer's management key = issuerAddr
        vm.prank(issuerAddr);
        issuer = new ClaimIssuer(issuerAddr);

        // Give issuerAddr a CLAIM key so its signatures count as valid claims.
        bytes32 issuerClaimKey = keccak256(abi.encode(issuerAddr));
        vm.prank(issuerAddr); // management key authorizes the new key
        issuer.addKey(issuerClaimKey, CLAIM_PURPOSE, ECDSA_KEY_TYPE);

        // Investor identity, managed by the investor wallet.
        vm.prank(investorAddr);
        investorId = new Identity(investorAddr, false);
    }

    /// @dev Build the exact hash the ClaimIssuer verifies, and sign it.
    function _signClaim(
        uint256 signerPk,
        uint256 topic,
        bytes memory data
    ) internal view returns (bytes memory signature) {
        // 1) message the standard hashes: keccak256(abi.encode(identity, topic, data))
        bytes32 message = keccak256(
            abi.encode(address(investorId), topic, data)
        );
        // 2) Ethereum Signed Message prefix
        bytes32 prefixed = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        // 3) sign
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, prefixed);
        signature = abi.encodePacked(r, s, v);
    }

    // 2.4 — a legitimately signed claim verifies
    function test_ValidClaimVerifies() public {
        bytes memory sig = _signClaim(issuerPk, TOPIC_KYC, claimData);
        assertTrue(issuer.isClaimValid(investorId, TOPIC_KYC, sig, claimData));
    }

    // 2.3 — the investor stores the claim on their identity, and we read it back
    function test_ClaimCanBeAddedAndReadByTopic() public {
        bytes memory sig = _signClaim(issuerPk, TOPIC_KYC, claimData);

        // Only a management/claim key on the investor's identity may addClaim.
        // The investor (management key) adds the issuer's signed claim.
        vm.prank(investorAddr);
        investorId.addClaim(
            TOPIC_KYC,
            SCHEME_ECDSA,
            address(issuer),
            sig,
            claimData,
            ""
        );

        // Claim id is deterministic: keccak256(abi.encode(issuer, topic))
        bytes32 claimId = keccak256(abi.encode(address(issuer), TOPIC_KYC));
        (
            uint256 topic,
            uint256 scheme,
            address claimIssuer,
            bytes memory storedSig,
            bytes memory storedData,

        ) = investorId.getClaim(claimId);

        assertEq(topic, TOPIC_KYC);
        assertEq(scheme, SCHEME_ECDSA);
        assertEq(claimIssuer, address(issuer));
        assertEq(storedSig, sig);
        assertEq(storedData, claimData);
    }

    // 2.5 — tampered signature fails
    function test_TamperedSignatureIsRejected() public {
        bytes memory sig = _signClaim(issuerPk, TOPIC_KYC, claimData);
        // Flip one byte of the signature
        sig[10] = sig[10] ^ bytes1(0x01);
        assertFalse(issuer.isClaimValid(investorId, TOPIC_KYC, sig, claimData));
    }

    // 2.5 — a claim signed by a NON-issuer (untrusted) fails
    function test_UntrustedSignerIsRejected() public {
        bytes memory sig = _signClaim(attackerPk, TOPIC_KYC, claimData);
        assertFalse(issuer.isClaimValid(investorId, TOPIC_KYC, sig, claimData));
    }

    // 2.5 — right issuer, but claim data was changed -> hash mismatch -> fails
    function test_DataMismatchIsRejected() public {
        bytes memory sig = _signClaim(issuerPk, TOPIC_KYC, claimData);
        bytes memory differentData = abi.encode("FAILED_KYC");
        assertFalse(
            issuer.isClaimValid(investorId, TOPIC_KYC, sig, differentData)
        );
    }
}
