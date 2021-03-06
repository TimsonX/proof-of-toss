// var VersionStorage = artifacts.require("VersionStorage");
var Token = artifacts.require("Token");
var Main = artifacts.require("Main");
var BlockingGranter = artifacts.require("BlockingGranter");
var Blocker = artifacts.require("Blocker");

var argv = require('yargs-parser')(process.argv.slice(2));

module.exports = function(deployer) {
  deployer.deploy(Token, 0, 0, {gasPrice: 1000}).then(function() {

    if (argv._ && argv._[0] === 'test') {
      deployer.deploy(BlockingGranter, Token.address, {gasPrice: 1000});
      deployer.deploy(Blocker, Token.address, {gasPrice: 1000});
    }

    return deployer.deploy(Main, Token.address, {gasPrice: 1000});
  });
};
