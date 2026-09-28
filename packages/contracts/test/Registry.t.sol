// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";

import {Identity} from "@onchain-id/solidity/contracts/Identity.sol";
import {ClaimIssuer} from "@onchain-id/solidity/contracts/ClaimIssuer.sol";
import {IIdentity} from "@onchain-id/solidity/contracts/interface/IIdentity.sol";
import {IClaimIssuer} from "@onchain-id/solidity/contracts/interface/IClaimIssuer.sol";

import {ClaimTopicsRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import {TrustedIssuersRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import {IdentityRegistryStorage} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistryStorage.sol";
import {IdentityRegistry} from "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistry.sol";

contract RegistryTest is Test {
    uint256 constant CLAIM_PURPOSE = 3;
    uint256 constant ECDSA_KEY_TYPE = 1;
    uint256 constant TOPIC_KYC = 1;
    uint256 constant SCHEME_ECDSA = 1;
    uint16 constant COUNTRY_US = 840; // ISO 3166-1 numeric

    // registries
    ClaimTopicsRegistry ctr;
    TrustedIssuersRegistry tir;
    IdentityRegistryStorage irs;
    IdentityRegistry ir;

    // identity layer
    ClaimIssuer issuer;
    Identity investorId;

    // actors
    uint256 issuerPk = 0xA11CE;
    address issuerAddr = vm.addr(0xA11CE);
    uint256 investorPk = 0xB0B;
    address investorAddr = vm.addr(0xB0B);
    address unregistered = address(0xDEAD);

    bytes claimData = abi.encode("PASSED_KYC");

    function setUp() public {
        // ---- deploy + init the four registries ----
        ctr = new ClaimTopicsRegistry();
        ctr.init();

        tir = new TrustedIssuersRegistry();
        tir.init();

        irs = new IdentityRegistryStorage();
        irs.init();

        ir = new IdentityRegistry();
        ir.init(address(tir), address(ctr), address(irs));

        // storage must accept writes from this identity registry
        irs.bindIdentityRegistry(address(ir));

        // this test contract acts as the agent that registers investors
        ir.addAgent(address(this));

        // ---- identity layer (from Phase 2) ----
        vm.prank(issuerAddr);
        issuer = new ClaimIssuer(issuerAddr);
        vm.prank(issuerAddr);
        issuer.addKey(
            keccak256(abi.encode(issuerAddr)),
            CLAIM_PURPOSE,
            ECDSA_KEY_TYPE
        );

        vm.prank(investorAddr);
        investorId = new Identity(investorAddr, false);
    }

    // ---- helpers ----
    function _signClaim(
        uint256 signerPk,
        uint256 topic,
        bytes memory data
    ) internal view returns (bytes memory) {
        bytes32 message = keccak256(
            abi.encode(address(investorId), topic, data)
        );
        bytes32 prefixed = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, prefixed);
        return abi.encodePacked(r, s, v);
    }

    function _addKycClaimToInvestor() internal {
        bytes memory sig = _signClaim(issuerPk, TOPIC_KYC, claimData);
        vm.prank(investorAddr);
        investorId.addClaim(
            TOPIC_KYC,
            SCHEME_ECDSA,
            address(issuer),
            sig,
            claimData,
            ""
        );
    }

    function _requireKycAndTrustIssuer() internal {
        // token requires topic 1
        ctr.addClaimTopic(TOPIC_KYC);
        // trust our issuer for topic 1
        uint256[] memory topics = new uint256[](1);
        topics[0] = TOPIC_KYC;
        tir.addTrustedIssuer(IClaimIssuer(address(issuer)), topics);
    }

    // 3.5 — happy path: registered + required claim from trusted issuer => verified
    function test_VerifiedInvestorReturnsTrue() public {
        _requireKycAndTrustIssuer();
        _addKycClaimToInvestor();
        ir.registerIdentity(
            investorAddr,
            IIdentity(address(investorId)),
            COUNTRY_US
        );

        assertTrue(ir.isVerified(investorAddr));
        assertTrue(ir.contains(investorAddr));
        assertEq(ir.investorCountry(investorAddr), COUNTRY_US);
    }

    // 3.6 — unregistered wallet => false
    function test_UnregisteredReturnsFalse() public {
        _requireKycAndTrustIssuer();
        assertFalse(ir.isVerified(unregistered));
    }

    // 3.6 — registered but MISSING the required claim => false
    function test_MissingClaimReturnsFalse() public {
        _requireKycAndTrustIssuer();
        // no claim added to the investor's identity
        ir.registerIdentity(
            investorAddr,
            IIdentity(address(investorId)),
            COUNTRY_US
        );
        assertFalse(ir.isVerified(investorAddr));
    }

    // 3.6 — claim exists, but its issuer is NOT trusted => false
    function test_UntrustedIssuerReturnsFalse() public {
        ctr.addClaimTopic(TOPIC_KYC); // topic required...
        // ...but we deliberately DON'T add the issuer to the trusted list
        _addKycClaimToInvestor();
        ir.registerIdentity(
            investorAddr,
            IIdentity(address(investorId)),
            COUNTRY_US
        );
        assertFalse(ir.isVerified(investorAddr));
    }

    // Exit criterion: agent can register / update / remove
    function test_AgentCanUpdateAndRemove() public {
        _requireKycAndTrustIssuer();
        _addKycClaimToInvestor();

        ir.registerIdentity(
            investorAddr,
            IIdentity(address(investorId)),
            COUNTRY_US
        );
        assertTrue(ir.contains(investorAddr));

        // update country
        ir.updateCountry(investorAddr, 826); // UK
        assertEq(ir.investorCountry(investorAddr), 826);

        // remove
        ir.deleteIdentity(investorAddr);
        assertFalse(ir.contains(investorAddr));
        assertFalse(ir.isVerified(investorAddr));
    }

    // Shared-registry design: one storage can back a second IdentityRegistry
    function test_StorageCanBackMultipleRegistries() public {
        IdentityRegistry ir2 = new IdentityRegistry();
        ir2.init(address(tir), address(ctr), address(irs));
        irs.bindIdentityRegistry(address(ir2)); // same storage, second registry
        ir2.addAgent(address(this));

        _requireKycAndTrustIssuer();
        _addKycClaimToInvestor();

        // register via ir2; both registries read the SAME storage
        ir2.registerIdentity(
            investorAddr,
            IIdentity(address(investorId)),
            COUNTRY_US
        );
        assertTrue(ir2.isVerified(investorAddr));
        assertTrue(ir.contains(investorAddr)); // visible through the first registry too
    }
}
