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
import {ModularCompliance} from "@tokenysolutions/t-rex/contracts/compliance/modular/ModularCompliance.sol";
import {Token} from "@tokenysolutions/t-rex/contracts/token/Token.sol";

contract TokenTest is Test {
    uint256 constant CLAIM_PURPOSE = 3;
    uint256 constant ECDSA_KEY_TYPE = 1;
    uint256 constant TOPIC_KYC = 1;
    uint256 constant SCHEME_ECDSA = 1;
    uint16 constant COUNTRY_US = 840;

    // registries + compliance + token
    ClaimTopicsRegistry ctr;
    TrustedIssuersRegistry tir;
    IdentityRegistryStorage irs;
    IdentityRegistry ir;
    ModularCompliance compliance;
    Token token;

    // identity layer
    ClaimIssuer issuer;

    // actors
    uint256 issuerPk = 0xC1A13;
    address issuerAddr = vm.addr(0xC1A13);
    uint256 alicePk = 0xA11CE;
    address alice = vm.addr(0xA11CE);
    uint256 bobPk = 0xB0B;
    address bob = vm.addr(0xB0B);
    address carol = address(0xCAFE); // deliberately UNVERIFIED

    bytes claimData = abi.encode("PASSED_KYC");

    function setUp() public {
        // --- registries (Phase 3) ---
        ctr = new ClaimTopicsRegistry();
        ctr.init();
        tir = new TrustedIssuersRegistry();
        tir.init();
        irs = new IdentityRegistryStorage();
        irs.init();
        ir = new IdentityRegistry();
        ir.init(address(tir), address(ctr), address(irs));
        irs.bindIdentityRegistry(address(ir));
        ir.addAgent(address(this));

        // --- issuer (Phase 2) + required topic + trust ---
        vm.prank(issuerAddr);
        issuer = new ClaimIssuer(issuerAddr);
        vm.prank(issuerAddr);
        issuer.addKey(
            keccak256(abi.encode(issuerAddr)),
            CLAIM_PURPOSE,
            ECDSA_KEY_TYPE
        );

        ctr.addClaimTopic(TOPIC_KYC);
        uint256[] memory topics = new uint256[](1);
        topics[0] = TOPIC_KYC;
        tir.addTrustedIssuer(IClaimIssuer(address(issuer)), topics);

        // --- compliance (Phase 4), no modules => canTransfer always true ---
        compliance = new ModularCompliance();
        compliance.init();

        // --- the ERC-3643 token ---
        token = new Token();
        token.init(
            address(ir),
            address(compliance),
            "AssetGate Token",
            "AGT",
            18,
            address(0)
        );
        compliance.bindToken(address(token));
        token.addAgent(address(this));
        token.unpause();

        // --- verified investors + initial mint ---
        _makeVerifiedInvestor(alice);
        _makeVerifiedInvestor(bob);
        token.mint(alice, 1_000 ether);
    }

    // ---------- helpers ----------
    function _signClaim(
        uint256 signerPk,
        address identity,
        uint256 topic,
        bytes memory data
    ) internal pure returns (bytes memory) {
        bytes32 message = keccak256(abi.encode(identity, topic, data));
        bytes32 prefixed = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, prefixed);
        return abi.encodePacked(r, s, v);
    }

    function _makeVerifiedInvestor(
        address wallet
    ) internal returns (Identity id) {
        vm.prank(wallet);
        id = new Identity(wallet, false);

        bytes memory sig = _signClaim(
            issuerPk,
            address(id),
            TOPIC_KYC,
            claimData
        );
        vm.prank(wallet);
        id.addClaim(
            TOPIC_KYC,
            SCHEME_ECDSA,
            address(issuer),
            sig,
            claimData,
            ""
        );

        ir.registerIdentity(wallet, IIdentity(address(id)), COUNTRY_US);
    }

    // ---------- 5.2: the two gates ----------
    function test_VerifiedToVerifiedSucceeds() public {
        vm.prank(alice);
        token.transfer(bob, 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
        assertEq(token.balanceOf(alice), 900 ether);
    }

    function test_TransferToUnverifiedReverts() public {
        vm.prank(alice);
        vm.expectRevert(); // carol is not in the Identity Registry
        token.transfer(carol, 100 ether);
    }

    // ---------- ERC-20 surface intact ----------
    function test_Erc20SurfaceIntact() public {
        assertEq(token.name(), "AssetGate Token");
        assertEq(token.symbol(), "AGT");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1_000 ether);

        vm.prank(alice);
        token.approve(bob, 10 ether);
        assertEq(token.allowance(alice, bob), 10 ether);
    }

    // ---------- 5.4: access control ----------
    function test_OnlyAgentCanMint() public {
        vm.prank(carol);
        vm.expectRevert(); // carol is not an agent
        token.mint(alice, 1 ether);
    }

    // ---------- 5.5: issuer controls ----------
    function test_FrozenAddressCannotSend() public {
        token.setAddressFrozen(alice, true);
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 1 ether);
    }

    function test_PartialFreezeBlocksExcess() public {
        token.freezePartialTokens(alice, 950 ether); // free balance now 50
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 100 ether); // exceeds free balance
    }

    function test_ForcedTransferBypassesFreezeForRecovery() public {
        // simulate a compromised/locked wallet
        token.setAddressFrozen(alice, true);

        // agent recovers funds to a verified wallet, ignoring the freeze + compliance
        token.forcedTransfer(alice, bob, 200 ether);

        assertEq(token.balanceOf(bob), 200 ether);
        assertEq(token.balanceOf(alice), 800 ether);
    }

    function test_PauseBlocksAllTransfers() public {
        token.pause();
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 1 ether);

        token.unpause();
        vm.prank(alice);
        token.transfer(bob, 1 ether); // works again
        assertEq(token.balanceOf(bob), 1 ether);
    }

    function test_BurnReducesSupply() public {
        token.burn(alice, 100 ether);
        assertEq(token.balanceOf(alice), 900 ether);
        assertEq(token.totalSupply(), 900 ether);
    }
}
