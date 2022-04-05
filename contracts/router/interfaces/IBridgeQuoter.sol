// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IQuoter} from "./IQuoter.sol";
import {Offers} from "../libraries/LibOffers.sol";

interface IBridgeQuoter is IQuoter {
    function findBestPathInitialChain(
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut
    ) external view returns (Offers.FormattedOffer memory _bestOffer);

    function findBestPathDestinationChain(
        address _tokenIn,
        uint256 _amountIn,
        address _tokenOut
    ) external view returns (Offers.FormattedOffer memory _bestOffer);
}