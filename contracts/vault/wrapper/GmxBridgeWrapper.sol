// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import {MintBurnWrapper} from "./MintBurnWrapper.sol";

import {IERC20} from "@synapseprotocol/sol-lib/contracts/solc8/erc20/IERC20.sol";
import {SafeERC20} from "@synapseprotocol/sol-lib/contracts/solc8/erc20/SafeERC20.sol";

interface IGmx is IERC20 {
    function burn(address _account, uint256 _amount) external;

    function mint(address _account, uint256 _amount) external;
}

contract GmxBridgeWrapper is MintBurnWrapper {
    using SafeERC20 for IGmx;

    constructor(
        address _bridge,
        address _vault,
        address _gmx
    ) MintBurnWrapper(_bridge, _vault, "GMX (Synapse)", "synGMX", _gmx) {
        this;
    }

    /// @dev This will require GmxBridgeWrapper to be Minter for GMX. Don't ask why.
    function _burnFrom(address account, uint256 amount)
        internal
        virtual
        override
    {
        IGmx(nativeToken).burn(account, amount);
    }

    /// @dev This will require GmxBridgeWrapper to be Minter for GMX.
    function _mint(address to, uint256 amount) internal virtual override {
        IGmx(nativeToken).mint(to, amount);
    }
}
