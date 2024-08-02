import { call, put, takeLatest } from 'redux-saga/effects';
import RNBootSplash from 'react-native-bootsplash';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BIOMETRY_ENABLED_KEY, CURRENT_SERVER, TOKEN_KEY } from '../lib/constants';
// import UserPreferences from '../lib/methods/userPreferences';
import { selectServerRequest } from '../actions/server';
import { setAllPreferences } from '../actions/sortPreferences';
import { APP } from '../actions/actionsTypes';
import log from '../lib/methods/helpers/log';
import database from '../lib/database';
import { localAuthenticate } from '../lib/methods/helpers/localAuthentication';
import { appReady, appStart } from '../actions/app';
import { RootEnum } from '../definitions';
import { getSortPreferences } from '../lib/methods';
import { deepLinkingClickCallPush } from '../actions/deepLinking';
import { storage } from '../lib/methods/userPreferencesNew';

export const initLocalSettings = function* initLocalSettings() {
	const sortPreferences = getSortPreferences();
	yield put(setAllPreferences(sortPreferences));
};

// const BIOMETRY_MIGRATION_KEY = 'kBiometryMigration';

const restore = function* restore() {
	try {
		const server = storage.getString(CURRENT_SERVER);
		let userId = storage.getString(`${TOKEN_KEY}-${server}`);

		// Migration biometry setting from WatermelonDB to MMKV
		// TODO: remove it after a few versions
		// const hasMigratedBiometry = storage.getBool(BIOMETRY_MIGRATION_KEY);
		// if (!hasMigratedBiometry) {
		// 	const serversDB = database.servers;
		// 	const serversCollection = serversDB.get('servers');
		// 	const servers = yield serversCollection.query().fetch();
		// 	const isBiometryEnabled = servers.some(server => !!server.biometry);
		// 	storage.setBool(BIOMETRY_ENABLED_KEY, isBiometryEnabled);
		// 	storage.setBool(BIOMETRY_MIGRATION_KEY, true);
		// }

		if (!server) {
			yield put(appStart({ root: RootEnum.ROOT_OUTSIDE }));
		} else if (!userId) {
			const serversDB = database.servers;
			const serversCollection = serversDB.get('servers');
			const servers = yield serversCollection.query().fetch();

			// Check if there're other logged in servers and picks first one
			if (servers.length > 0) {
				for (let i = 0; i < servers.length; i += 1) {
					const newServer = servers[i].id;
					userId = storage.getString(`${TOKEN_KEY}-${newServer}`);
					if (userId) {
						return yield put(selectServerRequest(newServer));
					}
				}
			}
			yield put(appStart({ root: RootEnum.ROOT_OUTSIDE }));
		} else {
			const serversDB = database.servers;
			const serverCollections = serversDB.get('servers');

			let serverObj;
			try {
				yield localAuthenticate(server);
				serverObj = yield serverCollections.find(server);
			} catch {
				// Server not found
			}
			yield put(selectServerRequest(server, serverObj && serverObj.version));
		}

		yield put(appReady({}));
		const pushNotification = yield call(AsyncStorage.getItem, 'pushNotification');
		if (pushNotification) {
			const pushNotification = yield call(AsyncStorage.removeItem, 'pushNotification');
			yield call(deepLinkingClickCallPush, JSON.parse(pushNotification));
		}
	} catch (e) {
		log(e);
		yield put(appStart({ root: RootEnum.ROOT_OUTSIDE }));
	}
};

const start = function* start() {
	yield RNBootSplash.hide({ fade: true });
};

const root = function* root() {
	yield takeLatest(APP.INIT, restore);
	yield takeLatest(APP.START, start);
	yield takeLatest(APP.INIT_LOCAL_SETTINGS, initLocalSettings);
};
export default root;
