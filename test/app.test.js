const fs = require('fs');
const BN = require('bn.js');
const nearAPI = require('near-api-js');
const testUtils = require('./test-utils');
const getConfig = require('../src/config');
const { 
	KeyPair, Account,
	utils: { PublicKey, format: { parseNearAmount }},
	transactions: { createAccount, transfer, deployContract, functionCall, addKey, fullAccessKey, functionCallAccessKey },
} = nearAPI;
const { 
	near, contractAccount, contractName, contractMethods,
} = testUtils;
const { 
	GAS
} = getConfig();

jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe('deploy contract ' + contractName, () => {
	const contractId = contractAccount.accountId;
	console.log('\n\n contractId:', contractId, '\n\n');

	// config tests
	let alice, aliceId
	const fak = KeyPair.fromRandom('ed25519');
	const fakPublicKey = PublicKey.from(fak.publicKey);
	const accessKey = KeyPair.fromRandom('ed25519');
	const accessPublicKey = PublicKey.from(accessKey.publicKey);
	const randomKey = KeyPair.fromRandom('ed25519');


	beforeAll(async () => {
		aliceId = 'alice' + Date.now() + '.' + contractId;
		alice = new Account(near.connection, aliceId)
		console.log('\n\n Alice accountId:', aliceId, '\n\n');

		const contractBytes = fs.readFileSync('./out/main.wasm');
		const args = {
			owner_id: contractId,
		};

		const actions = [
			createAccount(),
			transfer(parseNearAmount('5')),
			deployContract(contractBytes),
			functionCall('new', args, GAS),
			addKey(fakPublicKey, fullAccessKey()),
			addKey(accessPublicKey, functionCallAccessKey(aliceId, contractMethods.changeMethods, '0'))
		];

		const result = await contractAccount.signAndSendTransaction(aliceId, actions);
		console.log('\n\n signAndSendTransaction result:', result, '\n\n');
	});

	test('owner can add access key', async () => {
		await contractAccount.functionCall(aliceId, 'add_access_key', {
			public_key: randomKey.publicKey.toString(),
			permission: {
				receiver_id: 'blahblah.' + contractId,
				method_names: 'foo,bar'
			}
		})
		const accessKeys = await alice.getAccessKeys();
		console.log('\n\n accessKeys:', accessKeys, '\n\n');
		expect(accessKeys.length).toEqual(3);
	});

	test('owner can remove', async () => {
		await contractAccount.functionCall(aliceId, 'delete_access_key', {
			public_key: randomKey.publicKey.toString(),
		})
		const accessKeys = await alice.getAccessKeys();
		console.log('\n\n accessKeys:', accessKeys, '\n\n');
		expect(accessKeys.length).toEqual(2);
	});

	test('owner cannot add receiver that is not subaccount', async () => {
		try {
			await contractAccount.functionCall(aliceId, 'add_access_key', {
				public_key: KeyPair.fromRandom('ed25519').publicKey.toString(),
				permission: {
					receiver_id: 'blahblah',
					method_names: 'foo,bar'
				}
			})
			expect(false)
		} catch(e) {
			expect(true)
		}
	});

	test('owner cannot delete full access key', async () => {
		try {
			await contractAccount.functionCall(aliceId, 'delete_access_key', {
				public_key: fakPublicKey,
			})
			expect(false)
		} catch(e) {
			expect(true)
		}
	});

});