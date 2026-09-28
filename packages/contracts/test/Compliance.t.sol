// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Test} from "forge-std/Test.sol";
import {ModularCompliance} from "@tokenysolutions/t-rex/contracts/compliance/modular/ModularCompliance.sol";
import {MaxHolderCountModule} from "../src/compliance/MaxHolderCountModule.sol";
// at the top with the other imports
import {MaxBalanceModule} from "@tokenysolutions/t-rex/contracts/compliance/modular/modules/MaxBalanceModule.sol";
import {CountryAllowModule} from "@tokenysolutions/t-rex/contracts/compliance/modular/modules/CountryAllowModule.sol";

contract ComplianceTest is Test {
    ModularCompliance compliance;
    MaxHolderCountModule holderModule;

    address tokenPlaceholder = address(this); // this test acts as the bound token
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCAFE0);
    address dave = address(0xDA7E);

    function setUp() public {
        compliance = new ModularCompliance();
        compliance.init();
        compliance.bindToken(tokenPlaceholder);

        holderModule = new MaxHolderCountModule();
        compliance.addModule(address(holderModule));

        compliance.callModuleFunction(
            abi.encodeWithSelector(
                MaxHolderCountModule.setMaxHolders.selector,
                address(compliance),
                2 // cap: at most 2 distinct holders
            ),
            address(holderModule)
        );
    }

    // helpers that imitate what the real token will do
    function _mint(address to, uint256 v) internal {
        require(compliance.canTransfer(address(0), to, v), "blocked");
        compliance.created(to, v);
    }

    function _transfer(address from, address to, uint256 v) internal {
        require(compliance.canTransfer(from, to, v), "blocked");
        compliance.transferred(from, to, v);
    }

    // 4.5 — compliant activity within the cap passes
    function test_WithinCapPasses() public {
        _mint(alice, 100);
        _mint(bob, 100);
        assertEq(holderModule.holderCount(address(compliance)), 2);
    }

    // 4.5 — a mint that would create a 3rd holder is blocked by the gate
    function test_ExceedingHolderCapReverts() public {
        _mint(alice, 100);
        _mint(bob, 100); // count = 2 (at cap)

        // The compliance gate itself must reject a 3rd distinct holder.
        assertFalse(compliance.canTransfer(address(0), carol, 100));
    }

    // 4.4 — bookkeeping: emptying a holder frees a slot
    function test_HolderCountTracksBurnAndTransfer() public {
        _mint(alice, 100);
        _mint(bob, 100); // count = 2 (at cap)

        // alice sends her ENTIRE balance to bob → alice empties, no new holder
        _transfer(alice, bob, 100); // count should drop to 1
        assertEq(holderModule.holderCount(address(compliance)), 1);

        // now a new holder fits again
        _mint(carol, 50);
        assertEq(holderModule.holderCount(address(compliance)), 2);
    }

    // exit criterion: owner can remove a module
    function test_OwnerCanRemoveModule() public {
        compliance.removeModule(address(holderModule));
        // with the cap module gone, a 3rd, 4th… holder is allowed
        _mint(alice, 1);
        _mint(bob, 1);
        _mint(carol, 1);
        _mint(dave, 1);
        assertTrue(true); // no revert
    }
}
