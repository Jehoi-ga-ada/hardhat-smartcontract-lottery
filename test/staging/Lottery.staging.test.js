const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Staging Tests", function () {
        let Lottery, LotteryEntranceFee, deployer

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer
            Lottery = await ethers.getContract("Lottery", deployer)
            LotteryEntranceFee = await Lottery.getEntranceFee()
        })

        describe("fulfillRandomWords", function () {
            it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                // enter the Lottery
                console.log("Setting up test...")
                const startingTimeStamp = await Lottery.getLatestTimeStamp()
                const accounts = await ethers.getSigners()

                console.log("Setting up Listener...")
                await new Promise(async (resolve, reject) => {
                    // setup listener before we enter the Lottery
                    // Just in case the blockchain moves REALLY fast
                    console.log("Listener initialized!")
                    Lottery.once("WinnerPicked", async () => {
                        console.log("WinnerPicked event fired!")
                        try {
                            // add our asserts here
                            const recentWinner = await Lottery.getRecentWinner()
                            const LotteryState = await Lottery.getLotteryState()
                            const winnerEndingBalance = await accounts[0].provider.getBalance(accounts[0].address)
                            const endingTimeStamp = await Lottery.getLatestTimeStamp()

                            await expect(Lottery.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            assert.equal(LotteryState, 0)
                            assert(
                                winnerEndingBalance >
                                winnerStartingBalance + LotteryEntranceFee
                            )
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()
                        } catch (error) {
                            console.log(error)
                            reject(error)
                        }
                    })
                    // Then entering the Lottery
                    console.log("Entering Lottery...")
                    const tx = await Lottery.enterLottery({ value: LotteryEntranceFee })
                    await tx.wait(1)
                    console.log("Ok, time to wait...")
                    const winnerStartingBalance = await accounts[0].provider.getBalance(accounts[0].address)

                    // and this code WONT complete until our listener has finished listening!
                })
            })
        })
    })