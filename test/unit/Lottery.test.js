const { network, getNamedAccounts, deployments, ethers} = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

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

        describe("performUpKeep", async function () {
            it("can only run if checkupKeep is true", async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const tx = await lottery.performUpKeep("0x")    
                assert(tx)
            })

            it("reverts when chekupKeep is false", async function() {
                await expect(lottery.performUpKeep("0x")).to.be.revertedWithCustomError(
                    lottery,
                    "Lottery__UpKeepNotNeeded"
                )
            })

            it("updates the lottery state, emits an event, and calls the vrf coordinator", async function () {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.send("evm_mine", [])
                const txResponse = await lottery.performUpKeep("0x")
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.logs[1].args.requestId
                const lotteryState = await lottery.getLotteryState()
                assert(Number(requestId) > 0)
                assert(Number(lotteryState) == 1)
            })
        })

        describe("fulfillRandomWords", function() {
            beforeEach(async function() {
                await lottery.enterLottery({value: lotteryEntranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 10])
                await network.provider.send("evm_mine", [])
            })

            it("can be only be called adter performUpKeep", async function() {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.getAddress()))
                    .to.be.revertedWith("nonexistent request")

                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.getAddress()))
                    .to.be.revertedWith("nonexistent request")
            })

            it("picks a winner, resets the lottery, and sends money", async function () {
                const additionalEntrances = 3
                const startingAccountIndex = 1
                const accounts = await ethers.getSigners()
                for(let i = startingAccountIndex; i < startingAccountIndex + additionalEntrances; i++) {
                    const accountConnectedLottery = lottery.connect(accounts[i])
                    await accountConnectedLottery.enterLottery({value: lotteryEntranceFee})
                }
                const startingTimeStamp = await lottery.getLatestTimeStamp()
                await new Promise(async (resolve, reject) => {
                    console.log("Promise initialized")
                    lottery.once("WinnerPicked", async () => {
                        console.log("Found the event!")
                        try{          
                            const recentWinner = await lottery.getRecentWinner()
                            console.log(recentWinner)
                            console.log(accounts[0].address)
                            console.log(accounts[1].address)
                            console.log(accounts[2].address)
                            console.log(accounts[3].address)
                            const lotteryState = await lottery.getLotteryState()
                            const endingTimeStamp = await lottery.getLatestTimeStamp()
                            const numPlayers = await lottery.getNumberOfPlayers()
                            assert.equal(numPlayers.toString(), "0")
                            assert.equal(lotteryState, 0)
                            assert(endingTimeStamp > startingTimeStamp)
                        } catch(e) {
                            console.log(e)
                            reject(e)
                        }
                        resolve()
                    })

                    const tx = await lottery.performUpKeep("0x")
                    const txReceipt = await tx.wait(1)
                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        txReceipt.logs[1].args.requestId, 
                        lottery.getAddress()
                    )
                })
            })
        })
    })