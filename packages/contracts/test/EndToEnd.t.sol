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

import {MaxHolderCountModule} from "../src/compliance/MaxHolderCountModule.sol";
import {BalanceCapModule} from "../src/compliance/BalanceCapModule.sol";
import {CountryRestrictModule} from "../src/compliance/CountryRestrictModule.sol";

contract EndToEndTest is Test {
    uint256 constant CLAIM_PURPOSE = 3;
    uint256 constant ECDSA_KEY_TYPE = 1;
    uint256 constant TOPIC_KYC = 1;
    uint256 constant SCHEME_ECDSA = 1;
    uint16 constant US = 840;
    uint16 constant CN = 156;

    ClaimTopicsRegistry ctr;
    TrustedIssuersRegistry tir;
    IdentityRegistryStorage irs;
    IdentityRegistry ir;
    ModularCompliance compliance;
    Token token;
    ClaimIssuer issuer;

    MaxHolderCountModule holderModule;
    BalanceCapModule balanceModule;
    CountryRestrictModule countryModule;

    uint256 issuerPk = 0xC1A13;
    address issuerAddr = vm.addr(0xC1A13);
    address alice = vm.addr(0xA11CE);
    address bob = vm.addr(0xB0B);
    address carol = vm.addr(0xCA401);
    address dave = vm.addr(0xDA7E); // verified, but CHINA (restricted)
    address eve = address(0xE7E); // UNVERIFIED

    bytes claimData = abi.encode("PASSED_KYC");

    function setUp() public {
        // registries (Phase 3)
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

        // issuer + required topic + trust (Phase 2)
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

        // compliance + token (Phase 4/5)
        compliance = new ModularCompliance();
        compliance.init();
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

        // three custom modules on the LIVE token (bind holder module before minting)
        holderModule = new MaxHolderCountModule();
        compliance.addModule(address(holderModule));
        _cfg(
            address(holderModule),
            abi.encodeWithSelector(
                MaxHolderCountModule.setMaxHolders.selector,
                address(compliance),
                5
            )
        );

        balanceModule = new BalanceCapModule();
        compliance.addModule(address(balanceModule));
        _cfg(
            address(balanceModule),
            abi.encodeWithSelector(
                BalanceCapModule.setMaxBalance.selector,
                address(compliance),
                10_000 ether
            )
        );

        countryModule = new CountryRestrictModule();
        compliance.addModule(address(countryModule));
        _cfg(
            address(countryModule),
            abi.encodeWithSelector(
                CountryRestrictModule.setCountryAllowed.selector,
                address(compliance),
                US,
                true
            )
        );

        // verified investors
        _makeInvestor(alice, US);
        _makeInvestor(bob, US);
        _makeInvestor(carol, US);
        _makeInvestor(dave, CN); // verified identity, restricted country

        // Flow B: issue tokens to a verified investor
        token.mint(alice, 1_000 ether);
    }

    // ---------- helpers ----------
    function _cfg(address module, bytes memory data) internal {
        compliance.callModuleFunction(data, module);
    }

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

    function _makeInvestor(address wallet, uint16 country) internal {
        vm.prank(wallet);
        Identity id = new Identity(wallet, false);
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
        ir.registerIdentity(wallet, IIdentity(address(id)), country);
    }

    // ============ FLOW A — Onboarding ============
    function test_FlowA_Onboarding() public {
        assertTrue(ir.isVerified(alice));
        assertTrue(ir.isVerified(dave)); // verified even though country is restricted
        assertFalse(ir.isVerified(eve)); // never onboarded
    }

    // ============ FLOW B — Issuance ============
    function test_FlowB_IssuanceToVerified() public {
        assertEq(token.balanceOf(alice), 1_000 ether);
    }

    function test_FlowB_MintToUnverifiedReverts() public {
        vm.expectRevert();
        token.mint(eve, 1 ether);
    }

    // ============ FLOW C — Transfer (the heart) ============
    function test_FlowC_VerifiedToVerifiedPasses() public {
        vm.prank(alice);
        token.transfer(bob, 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
    }

    function test_FlowC_ToUnverifiedReverts() public {
        // fails GATE 1 (identity): eve is not in the registry
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(eve, 100 ether);
    }

    function test_FlowC_CountryRestrictedReverts() public {
        // dave IS verified (gate 1 ok) but fails GATE 2 (compliance: country)
        assertTrue(ir.isVerified(dave));
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(dave, 100 ether);
    }

    // ============ FLOW D — Corporate control ============
    function test_FlowD_FreezeForceTransferPause() public {
        // freeze blocks the sender
        token.setAddressFrozen(alice, true);
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 1 ether);

        // recovery: agent force-transfers out of the frozen wallet (bypasses freeze + compliance)
        token.forcedTransfer(alice, bob, 200 ether);
        assertEq(token.balanceOf(bob), 200 ether);
        token.setAddressFrozen(alice, false);

        // pause halts everything, unpause restores
        token.pause();
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 1 ether);
        token.unpause();
        vm.prank(alice);
        token.transfer(bob, 1 ether);
        assertEq(token.balanceOf(bob), 201 ether);
    }

    // ============ 6.5 — boundary tests ============
    function test_Boundary_HolderCapExact() public {
        // tighten to exactly 2 holders (alice already holds -> count = 1)
        _cfg(
            address(holderModule),
            abi.encodeWithSelector(
                MaxHolderCountModule.setMaxHolders.selector,
                address(compliance),
                2
            )
        );

        vm.prank(alice);
        token.transfer(bob, 100 ether); // bob = holder #2 (== cap, allowed)

        vm.prank(alice);
        vm.expectRevert();
        token.transfer(carol, 100 ether); // carol would be #3 (> cap)
    }

    function test_Boundary_BalanceCapExact() public {
        _cfg(
            address(balanceModule),
            abi.encodeWithSelector(
                BalanceCapModule.setMaxBalance.selector,
                address(compliance),
                500 ether
            )
        );

        vm.prank(alice);
        token.transfer(bob, 500 ether); // bob 0 + 500 == cap (allowed)
        assertEq(token.balanceOf(bob), 500 ether);

        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 1 ether); // 500 + 1 > cap
    }

    // ============ 6.5 — fuzz tests ============
    function testFuzz_VerifiedTransferUpdatesBalances(uint256 amount) public {
        amount = bound(amount, 1, 1_000 ether); // alice's balance; caps are generous
        vm.prank(alice);
        token.transfer(bob, amount);
        assertEq(token.balanceOf(bob), amount);
    }

    function testFuzz_TransferToUnverifiedAlwaysReverts(uint256 amount) public {
        amount = bound(amount, 1, 1_000 ether);
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(eve, amount);
    }
}
