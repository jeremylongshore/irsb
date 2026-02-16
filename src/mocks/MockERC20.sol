// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Simple ERC20 mock for testing
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @title MockERC20FeeOnTransfer
/// @notice Mock ERC20 with fee-on-transfer for testing SafeERC20
contract MockERC20FeeOnTransfer is ERC20 {
    uint256 public constant FEE_BPS = 100; // 1% fee

    constructor() ERC20("Fee Token", "FEE") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * FEE_BPS) / 10000;
        uint256 netAmount = amount - fee;
        _burn(msg.sender, fee); // Burn the fee
        return super.transfer(to, netAmount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        uint256 fee = (amount * FEE_BPS) / 10000;
        uint256 netAmount = amount - fee;
        _burn(from, fee); // Burn the fee
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, netAmount);
        return true;
    }
}
