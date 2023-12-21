const { network, getNamedAccounts, deployments, ethers} = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")
require("@nomiclabs/hardhat-ethers")

!developmentChains.includes(network.name) 
    ? describe.skip
    : describe("Lottery Unit Tests", async function () {
        let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
        const chainId = network.config.chainId
        
        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            lottery = await ethers.getContract("Lottery", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            lotteryEntranceFee = await lottery.getEntranceFee()
            interval = await lottery.getInterval()
        })

        describe("constructor", async function () {
            it("initializes the lottery correctly", async function () {
                const lotteryState = await lottery.getLotteryState()
                assert.equal(lotteryState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })

        describe("enterLottery", async function() {
            it("reverts when you don't pay enough", async function () {
                await expect(lottery.enterLottery()).to.be.revertedWithCustomError(lottery ,"Lottery__NotEnoughETHEntered")
            })
            it("records players when they enter", async () => {
                await lottery.enterLottery({ value: lotteryEntranceFee })
                const playerFromContract = await lottery.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })
            it("emits event on enter", async () => {
                await expect(lottery.enterLottery({ value: lotteryEntranceFee})).to.emit(
                    lottery, 
                    "LotteryEnter"
                )
            })
            it("doesnt allow entrance when lottery is calculating", async function() {
                await lottery.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])

                await lottery.performUpKeep("0x")
                await expect(lottery.enterLottery({ value: lotteryEntranceFee}))
                    .to.be.revertedWithCustomError(lottery, "Lottery__NotOpen")
            })
        })

        describe("checkUpKeep", async function() {
            it("returns false if people haven't sent any ETH", async function() {
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])

                const {upkeepNeeded} = await lottery.checkUpKeep.staticCall("0x")
                assert(!upkeepNeeded) 
            })
            it("returns false if lottery isn't open", async function () {
                await lottery.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                await lottery.performUpKeep("0x")
                const lotteryState = await lottery.getLotteryState()
                const {upkeepNeeded} = await lottery.checkUpKeep.staticCall("0x")
                assert.equal(lotteryState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })
            it("returns false if enough time hasn't passed", async () => {
                await lottery.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) - 5])
                await network.provider.send("evm_mine", [])

                const { upkeepNeeded } = await lottery.checkUpKeep.staticCall("0x")
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await lottery.enterLottery({ value: lotteryEntranceFee })
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const { upkeepNeeded } = await lottery.checkUpKeep.staticCall("0x")
                assert(upkeepNeeded)
            })
        })

        
    })