// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {DividendDistributor} from "../src/dividends/DividendDistributor.sol";

contract DividendTest is Test {
    MockUSDC usdc;
    DividendDistributor dist;
    address issuer = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        dist = new DividendDistributor(address(usdc));
        usdc.mint(issuer, 1_000_000 ether);
        usdc.approve(address(dist), type(uint256).max);
    }

    // OZ StandardMerkleTree leaf + sorted-pair hashing
    function _leaf(address a, uint256 amt) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(a, amt))));
    }
    function _pair(bytes32 x, bytes32 y) internal pure returns (bytes32) {
        return
            x < y
                ? keccak256(abi.encodePacked(x, y))
                : keccak256(abi.encodePacked(y, x));
    }

    function test_ProRataClaim() public {
        uint256 total = 100 ether;
        uint256 aliceAmt = 70 ether; // 70%
        uint256 bobAmt = 30 ether; // 30%
        bytes32 la = _leaf(alice, aliceAmt);
        bytes32 lb = _leaf(bob, bobAmt);
        uint256 id = dist.createDistribution(_pair(la, lb), total);

        bytes32[] memory proofA = new bytes32[](1);
        proofA[0] = lb;
        vm.prank(alice);
        dist.claim(id, aliceAmt, proofA);
        assertEq(usdc.balanceOf(alice), aliceAmt);

        bytes32[] memory proofB = new bytes32[](1);
        proofB[0] = la;
        vm.prank(bob);
        dist.claim(id, bobAmt, proofB);
        assertEq(usdc.balanceOf(bob), bobAmt);
    }

    function test_DoubleClaimReverts() public {
        bytes32 la = _leaf(alice, 70 ether);
        bytes32 lb = _leaf(bob, 30 ether);
        uint256 id = dist.createDistribution(_pair(la, lb), 100 ether);
        bytes32[] memory proofA = new bytes32[](1);
        proofA[0] = lb;
        vm.prank(alice);
        dist.claim(id, 70 ether, proofA);
        vm.prank(alice);
        vm.expectRevert(bytes("already claimed"));
        dist.claim(id, 70 ether, proofA);
    }

    function test_InvalidProofReverts() public {
        bytes32 la = _leaf(alice, 70 ether);
        bytes32 lb = _leaf(bob, 30 ether);
        uint256 id = dist.createDistribution(_pair(la, lb), 100 ether);
        bytes32[] memory bad = new bytes32[](1);
        bad[0] = _leaf(bob, 999 ether);
        vm.prank(alice);
        vm.expectRevert(bytes("invalid proof"));
        dist.claim(id, 70 ether, bad);
    }
}
