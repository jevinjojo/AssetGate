// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {PermissionedToken} from "../src/PermissionedToken.sol";

contract PermissionedTokenTest is Test {
    PermissionedToken token;
    address owner = address(this);
    address alice = address(0xA11CE); // will be whitelisted (verified)
    address bob = address(0xB0B); // NOT whitelisted (unverified)

    function setUp() public {
        token = new PermissionedToken(); // owner = this, auto-whitelisted
        token.setWhitelist(alice, true);
        token.mint(owner, 1_000 ether);
    }

    function test_CompliantTransferSucceeds() public {
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
        assertEq(token.balanceOf(owner), 900 ether);
    }

    function test_TransferToUnverifiedReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedToken.NotWhitelisted.selector,
                bob
            )
        );
        token.transfer(bob, 100 ether);
    }

    function test_MintToUnverifiedReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                PermissionedToken.NotWhitelisted.selector,
                bob
            )
        );
        token.mint(bob, 1 ether);
    }

    function test_OnlyOwnerCanWhitelist() public {
        vm.prank(alice);
        vm.expectRevert(PermissionedToken.NotOwner.selector);
        token.setWhitelist(bob, true);
    }
}
