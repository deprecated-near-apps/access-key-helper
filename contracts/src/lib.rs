use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupSet};
use near_sdk::json_types::{Base58PublicKey, U128};
use near_sdk::{ env, near_bindgen, PanicOnDefault, AccountId, PublicKey, Promise };
use near_sdk::serde::{Deserialize, Serialize};

const DEFAULT_ALLOWANCE: u128 = 0;
/// Permissions for function call access key
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AccessKeyPermission {
    allowance: Option<U128>,
    receiver_id: AccountId,
    method_names: String,
}

near_sdk::setup_alloc!();

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub added_by_helper: LookupSet<PublicKey>
}

#[near_bindgen]
impl Contract {

    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            owner_id,
            added_by_helper: LookupSet::new(b"a".to_vec()),
        }
    }

    pub fn add_access_key(&mut self, public_key: Base58PublicKey, permission: AccessKeyPermission) {
        self.assert_owner();
        let account_id = env::current_account_id();
        let pk: PublicKey = public_key.into();
        self.added_by_helper.insert(&pk);

        // checks receiver_id is subaccount of owner_id
        assert!(permission.receiver_id.contains(&format!(".{}", self.owner_id)), "Limited to subaccounts of owner_id");

        Promise::new(account_id).add_access_key(
            pk,
            permission.allowance.map(|x| x.into()).unwrap_or(DEFAULT_ALLOWANCE),
            permission.receiver_id,
            permission.method_names.into_bytes(),
        );
    }

    pub fn delete_access_key(&mut self, public_key: Base58PublicKey) {
        self.assert_owner();
        let pk: PublicKey = public_key.into();
        assert_eq!(self.added_by_helper.remove(&pk), true, "Not a key belonging to owner");
        let account_id = env::current_account_id();
        Promise::new(account_id).delete_key(pk);
    }

    fn assert_owner(&self) {
        assert_eq!(
            &env::predecessor_account_id(),
            &self.owner_id,
            "Owner's method"
        );
    }
}
