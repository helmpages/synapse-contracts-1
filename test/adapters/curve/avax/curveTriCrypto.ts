//@ts-nocheck
import chai from "chai"
import { solidity } from "ethereum-waffle"

import { getUserTokenBalance } from "../../../utils"
import { getBigNumber } from "../../../bridge/utilities"
import {
  testRunAdapter,
  range,
  prepareAdapterFactories,
  setupAdapterTests,
  forkChain,
  getAmounts,
  getSwapsAmount,
  doSwap,
} from "../../utils/helpers"

import config from "../../../config.json"
import adapters from "../../adapters.json"

chai.use(solidity)
const { expect } = chai

const CHAIN = 43114
const DEX = "curve"
const POOL = "tricrypto"
const STORAGE = "tricryptopool"
const ADAPTER = adapters[CHAIN][DEX][POOL]
const ADAPTER_NAME = String(ADAPTER.params[0])

describe(ADAPTER_NAME, function () {
  const tokenSymbols: Array<String> = [
    "DAIe",
    "USDCe",
    "USDTe",
    "WBTCe",
    "WETHe",
  ]
  const poolTokenSymbols: Array<String> = [
    "avCRV",
    "avCRV",
    "avCRV",
    "avWBTC",
    "avWETH",
  ]

  const ALL_TOKENS: Array<Number> = range(tokenSymbols.length)

  // MAX_SHARE = 1000
  const SHARE_SMALL: Array<Number> = [1, 12, 29, 42]
  const SHARE_BIG: Array<Number> = [66, 121]

  let swapsPerTime: number =
    SHARE_SMALL.length * getSwapsAmount(tokenSymbols.length)
  const timesSmall: number = Math.floor(40 / swapsPerTime) + 1
  const swapsAmount: number = timesSmall * swapsPerTime

  swapsPerTime = SHARE_BIG.length * getSwapsAmount(tokenSymbols.length)
  const timesBig = Math.floor(30 / swapsPerTime) + 1
  const swapsAmountBig = timesBig * swapsPerTime

  const AMOUNTS: Array<Number> = []
  const AMOUNTS_BIG: Array<Number> = []

  const MAX_UNDERQUOTE = 1
  const CHECK_UNDERQUOTING = false

  const MINT_AMOUNT = getBigNumber("1000000000000000000")

  before(async function () {
    // 2022-01-24
    await forkChain(process.env.AVAX_API, 10000000)
    await prepareAdapterFactories(this, ADAPTER)
  })

  beforeEach(async function () {
    await setupAdapterTests(
      this,
      config[CHAIN],
      ADAPTER,
      tokenSymbols,
      MAX_UNDERQUOTE,
      MINT_AMOUNT,
    )

    for (let token of this.tokens) {
      expect(await getUserTokenBalance(this.ownerAddress, token)).to.eq(
        MINT_AMOUNT,
      )
    }

    AMOUNTS = await getAmounts(
      config[CHAIN],
      config[CHAIN][DEX][STORAGE],
      poolTokenSymbols,
      SHARE_SMALL,
    )
    AMOUNTS_BIG = await getAmounts(
      config[CHAIN],
      config[CHAIN][DEX][STORAGE],
      poolTokenSymbols,
      SHARE_BIG,
    )

    // We counted 3CRV balance for all stables, which has 18 decimals
    let diff = getBigNumber(1, 12)
    for (let index in tokenSymbols) {
      if (["USDCe", "USDTe"].includes(tokenSymbols[index])) {
        for (let j in AMOUNTS[index]) {
          AMOUNTS[index][j] = AMOUNTS[index][j].div(diff)
        }
        for (let j in AMOUNTS_BIG[index]) {
          AMOUNTS_BIG[index][j] = AMOUNTS_BIG[index][j].div(diff)
        }
      }
    }
  })

  describe("Sanity checks", function () {
    it("Curve Adapter is properly set up", async function () {
      expect(await this.adapter.pool()).to.eq(config[CHAIN][DEX][POOL])

      for (let i in this.tokens) {
        let token = this.tokens[i].address
        expect(await this.adapter.isPoolToken(token))
        expect(await this.adapter.tokenIndex(token)).to.eq(+i)
      }
    })

    it("Swap fails if transfer amount is too little", async function () {
      let indexFrom = 0
      let indexTo = 1
      let amount = getBigNumber(10, this.tokenDecimals[indexFrom])
      await expect(doSwap(this, amount, indexFrom, indexTo, -1)).to.be.reverted
    })

    it("Only Owner can rescue overprovided swap tokens", async function () {
      let indexFrom = 0
      let indexTo = 1
      let amount = getBigNumber(10, this.tokenDecimals[indexFrom])
      let extra = getBigNumber(42, this.tokenDecimals[indexFrom] - 1)
      await doSwap(this, amount, indexFrom, indexTo, extra)

      await expect(
        this.adapter
          .connect(this.dude)
          .recoverERC20(this.tokens[indexFrom].address),
      ).to.be.revertedWith("Ownable: caller is not the owner")

      await expect(() =>
        this.adapter.recoverERC20(this.tokens[indexFrom].address),
      ).to.changeTokenBalance(this.tokens[indexFrom], this.owner, extra)
    })

    it("Anyone can take advantage of overprovided swap tokens", async function () {
      let indexFrom = 3
      let indexTo = 4
      let amount = getBigNumber(10, this.tokenDecimals[indexFrom])
      let extra = getBigNumber(42, this.tokenDecimals[indexFrom] - 1)
      await doSwap(this, amount, indexFrom, indexTo, extra)

      let swapQuote = await this.adapter.query(
        extra,
        this.tokens[indexFrom].address,
        this.tokens[indexTo].address,
      )

      // .add(MAX_UNDERQUOTE) to reflect underquoting
      await expect(() =>
        doSwap(this, extra, indexFrom, indexTo, 0, "dude", false),
      ).to.changeTokenBalance(
        this.tokens[indexTo],
        this.dude,
        swapQuote.add(MAX_UNDERQUOTE),
      )
    })

    it("Only Owner can rescue GAS from Adapter", async function () {
      let amount = 42690
      await expect(() =>
        this.owner.sendTransaction({
          to: this.adapter.address,
          value: amount,
        }),
      ).to.changeEtherBalance(this.adapter, amount)

      await expect(
        this.adapter.connect(this.dude).recoverGAS(),
      ).to.be.revertedWith("Ownable: caller is not the owner")

      await expect(() => this.adapter.recoverGAS()).to.changeEtherBalances(
        [this.adapter, this.owner],
        [-amount, amount],
      )
    })
  })

  describe("Adapter Swaps", function () {
    it(
      "Swaps between tokens [" + swapsAmount + " small-medium swaps]",
      async function () {
        await testRunAdapter(
          this,
          ALL_TOKENS,
          ALL_TOKENS,
          timesSmall,
          AMOUNTS,
          CHECK_UNDERQUOTING,
        )
      },
    )

    it(
      "Swaps between tokens [" + swapsAmountBig + " big-ass swaps]",
      async function () {
        await testRunAdapter(
          this,
          ALL_TOKENS,
          ALL_TOKENS,
          timesBig,
          AMOUNTS_BIG,
          CHECK_UNDERQUOTING,
        )
      },
    )
  })
})
