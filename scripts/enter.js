const { ethers } = require("hardhat")

async function enterLottery() {
    const Lottery = await ethers.getContract("Lottery")
    const entranceFee = await Lottery.getEntranceFee()
    await Lottery.enterLottery({ value: entranceFee + 1 })
    console.log("Entered!")
}

enterLottery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })