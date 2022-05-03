//@ts-nocheck
import { BigNumber, Signer } from "ethers"
import { MAX_UINT256, getUserTokenBalance } from "../../utils"
import { solidity } from "ethereum-waffle"
import { deployments } from "hardhat"

import { TestAdapterSwap } from "../build/typechain/TestAdapterSwap"

import { GenericERC20 } from "../../../build/typechain/GenericERC20"
import { LPToken } from "../../../build/typechain/LPToken"
import { Swap } from "../../../build/typechain/Swap"
import { SynapseBaseMainnetAdapter } from "../../../build/typechain/SynapseBaseMainnetAdapter"
import chai from "chai"
import { getBigNumber } from "../../bridge/utilities"

chai.use(solidity)
const { expect } = chai

describe("Base Pool Adapter on Mainnet", async function () {
  let signers: Array<Signer>
  let swap: Swap
  let DAI: GenericERC20
  let USDC: GenericERC20
  let USDT: GenericERC20

  let swapToken: LPToken
  let owner: Signer
  let ownerAddress: string
  let dude: Signer
  let dudeAddress: string

  let basePoolAdapter: SynapseBaseMainnetAdapter

  let testAdapterSwap: TestAdapterSwap

  let swapStorage: {
    initialA: BigNumber
    futureA: BigNumber
    initialATime: BigNumber
    futureATime: BigNumber
    swapFee: BigNumber
    adminFee: BigNumber
    lpToken: string
  }

  // Test Values
  const INITIAL_A_VALUE = 50
  const SWAP_FEE = 1e7
  const LP_TOKEN_NAME = "Test LP Token Name"
  const LP_TOKEN_SYMBOL = "TESTLP"
  const TOKENS: GenericERC20[] = []
  const TOKENS_DECIMALS = [18, 6, 6, 18]

  const AMOUNTS = [2, 6, 15, 49]
  const AMOUNTS_BIG = [123, 404, 777]
  const CHECK_UNDERQUOTING = true

  async function testAdapter(
    adapter: SynapseBaseMainnetAdapter,
    tokensFrom: Array<number>,
    tokensTo: Array<number>,
    times = 1,
    amounts = AMOUNTS,
  ) {
    let swapsAmount = 0
    for (var k = 0; k < times; k++)
      for (let i of tokensFrom) {
        let tokenFrom = TOKENS[i]
        let decimalsFrom = TOKENS_DECIMALS[i]
        for (let j of tokensTo) {
          if (i == j) {
            continue
          }
          let tokenTo = TOKENS[j]
          for (let amount of amounts) {
            swapsAmount++
            await testAdapterSwap.testSwap(
              adapter.address,
              getBigNumber(amount, decimalsFrom),
              tokenFrom.address,
              tokenTo.address,
              CHECK_UNDERQUOTING,
              swapsAmount,
            )
          }
        }
      }
    console.log("Swaps: %s", swapsAmount)
  }

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      const { get } = deployments
      await deployments.fixture() // ensure you start from a fresh deployments

      TOKENS.length = 0
      signers = await ethers.getSigners()
      owner = signers[0]
      ownerAddress = await owner.getAddress()
      dude = signers[1]
      dudeAddress = await dude.getAddress()

      const testFactory = await ethers.getContractFactory("TestAdapterSwap")
      testAdapterSwap = (await testFactory.deploy(0)) as TestAdapterSwap

      // Deploy dummy tokens
      const erc20Factory = await ethers.getContractFactory("GenericERC20")

      DAI = (await erc20Factory.deploy("DAI", "DAI", "18")) as GenericERC20
      USDC = (await erc20Factory.deploy("USDC", "USDC", "6")) as GenericERC20
      USDT = (await erc20Factory.deploy("USDT", "USDT", "6")) as GenericERC20

      // Mint dummy tokens
      await DAI.mint(ownerAddress, getBigNumber(100000, TOKENS_DECIMALS[0]))
      await USDC.mint(ownerAddress, getBigNumber(100000, TOKENS_DECIMALS[1]))
      await USDT.mint(ownerAddress, getBigNumber(100000, TOKENS_DECIMALS[2]))

      // Deploy Swap with SwapUtils library
      const swapFactory = await ethers.getContractFactory("Swap", {
        libraries: {
          SwapUtils: (await get("SwapUtils")).address,
          AmplificationUtils: (await get("AmplificationUtils")).address,
        },
      })
      swap = (await swapFactory.deploy()) as Swap

      await swap.initialize(
        [DAI.address, USDC.address, USDT.address],
        [18, 6, 6],
        LP_TOKEN_NAME,
        LP_TOKEN_SYMBOL,
        INITIAL_A_VALUE,
        SWAP_FEE,
        0,
        (
          await get("LPToken")
        ).address,
      )

      expect(await swap.getVirtualPrice()).to.be.eq(0)

      swapStorage = await swap.swapStorage()

      swapToken = (await ethers.getContractAt(
        "LPToken",
        swapStorage.lpToken,
      )) as LPToken

      TOKENS.push(DAI, USDC, USDT, swapToken)

      for (let token of TOKENS) {
        await token.approve(swap.address, MAX_UINT256)
        await token.approve(testAdapterSwap.address, MAX_UINT256)
      }

      const basePoolAdapterFactory = await ethers.getContractFactory(
        "SynapseBaseMainnetAdapter",
      )

      basePoolAdapter = (await basePoolAdapterFactory.deploy(
        "BasePoolAdapter",
        160000,
        swap.address,
      )) as SynapseBaseMainnetAdapter

      let amounts = [
        getBigNumber(2000, TOKENS_DECIMALS[0]),
        getBigNumber(2000, TOKENS_DECIMALS[1]),
        getBigNumber(2000, TOKENS_DECIMALS[2]),
      ]

      // Populate the pool with initial liquidity
      await swap.addLiquidity(amounts, 0, MAX_UINT256)

      for (let i in amounts) {
        expect(await swap.getTokenBalance(i)).to.be.eq(amounts[i])
      }

      expect(await getUserTokenBalance(owner, swapToken)).to.be.eq(
        getBigNumber(6000),
      )
    },
  )

  beforeEach(async function () {
    await setupTest()
  })

  describe("Setup", () => {
    it("BasePool Adapter is properly set up", async function () {
      expect(await basePoolAdapter.pool()).to.be.eq(swap.address)
      expect(await basePoolAdapter.lpToken()).to.be.eq(swapToken.address)
      expect(await basePoolAdapter.numTokens()).to.be.eq(TOKENS.length - 1)
      expect(await basePoolAdapter.swapFee()).to.be.eq(SWAP_FEE)

      for (let i in TOKENS) {
        expect(await basePoolAdapter.isPoolToken(TOKENS[i].address))
        expect(await basePoolAdapter.tokenIndex(TOKENS[i].address)).to.eq(+i)
      }
    })
  })

  describe("Adapter Swaps", () => {
    it("Swap stress test [48 small-medium sized swaps]", async function () {
      await testAdapter(basePoolAdapter, [0, 1, 2, 3], [0, 1, 2, 3], 1)
    })

    it("Swap stress test [36 big sized swaps]", async function () {
      await testAdapter(
        basePoolAdapter,
        [0, 1, 2, 3],
        [0, 1, 2, 3],
        1,
        AMOUNTS_BIG,
      )
    })
  })

  describe("Wrong amount transferred", () => {
    it("Swap fails if transfer amount is too little", async function () {
      let amount = getBigNumber(10, TOKENS_DECIMALS[0])
      let depositAddress = await basePoolAdapter.depositAddress(
        TOKENS[0].address,
        TOKENS[1].address,
      )
      TOKENS[0].transfer(depositAddress, amount.sub(1))
      await expect(
        basePoolAdapter.swap(
          amount,
          TOKENS[0].address,
          TOKENS[1].address,
          ownerAddress,
        ),
      ).to.be.reverted
    })

    it("Only Owner can rescue overprovided swap tokens", async function () {
      let amount = getBigNumber(10, TOKENS_DECIMALS[0])
      let extra = getBigNumber(42, TOKENS_DECIMALS[0] - 1)
      let depositAddress = await basePoolAdapter.depositAddress(
        TOKENS[0].address,
        TOKENS[1].address,
      )
      TOKENS[0].transfer(depositAddress, amount.add(extra))
      await basePoolAdapter.swap(
        amount,
        TOKENS[0].address,
        TOKENS[1].address,
        ownerAddress,
      )

      await expect(
        basePoolAdapter.connect(dude).recoverERC20(TOKENS[0].address),
      ).to.be.revertedWith("Ownable: caller is not the owner")

      await expect(() =>
        basePoolAdapter.recoverERC20(TOKENS[0].address),
      ).to.changeTokenBalance(TOKENS[0], owner, extra)
    })

    it("Anyone can take advantage of overprovided swap tokens", async function () {
      let amount = getBigNumber(10, TOKENS_DECIMALS[0])
      let extra = getBigNumber(42, TOKENS_DECIMALS[0] - 1)
      let depositAddress = await basePoolAdapter.depositAddress(
        TOKENS[0].address,
        TOKENS[1].address,
      )
      TOKENS[0].transfer(depositAddress, amount.add(extra))
      await basePoolAdapter.swap(
        amount,
        TOKENS[0].address,
        TOKENS[1].address,
        ownerAddress,
      )

      let swapQuote = await basePoolAdapter.query(
        extra,
        TOKENS[0].address,
        TOKENS[1].address,
      )

      await expect(() =>
        basePoolAdapter
          .connect(dude)
          .swap(extra, TOKENS[0].address, TOKENS[1].address, dudeAddress),
      ).to.changeTokenBalance(TOKENS[1], dude, swapQuote)
    })

    it("Only Owner can rescue GAS from Adapter", async function () {
      let amount = 42690
      await expect(() =>
        owner.sendTransaction({ to: basePoolAdapter.address, value: amount }),
      ).to.changeEtherBalance(basePoolAdapter, amount)

      await expect(
        basePoolAdapter.connect(dude).recoverGAS(),
      ).to.be.revertedWith("Ownable: caller is not the owner")

      await expect(() => basePoolAdapter.recoverGAS()).to.changeEtherBalances(
        [basePoolAdapter, owner],
        [-amount, amount],
      )
    })
  })
})
