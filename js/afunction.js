import { lib, game, ui, get, ai, _status } from './utils.js';

/* 统一的 link 提取：兼容 string / DOM / 带 link 属性的对象 */
function _djscSafeLink(x) {
	if (typeof x === "string") return x;
	if (!x || typeof x !== "object") return null;
	if (typeof x.link === "string") return x.link;
	if (x.dataset && typeof x.dataset.link === "string") return x.dataset.link;
	if (x.node && typeof x.node.link === "string") return x.node.link;
	/* 兜底：从 dataset 里找任意字符串型 link */
	if (x.dataset) {
		for (const k in x.dataset) {
			if (typeof x.dataset[k] === "string" && /^[a-z_][a-z0-9_]*$/i.test(x.dataset[k])) {
				return x.dataset[k];
			}
		}
	}
	return null;
}

lib.chooseAICharacter = lib.chooseAICharacter || {
	chooseCharacter: function (target) {
		const mode = lib.config.mode;
		if (mode === 'identity' || mode === 'doudizhu') {
			this.chooseCharacterShenFen.call(target);
		} else if (mode === 'guozhan') {
			this.chooseCharacterGuoZhan.call(target);
		}
	},
	chooseCharacterShenFen: function () {
		const target = this;
		const event = game.createEvent('chooseCharacter', false);
		event.target = target;
		event.player = game.me;
		event.filter = (name) => {
			return !(lib.character[name][1] === 'key' || name.indexOf('key') === 0);
		};
		event.setContent(async function () {
			ui.arena.classList.add('choose-character');
			const chosen = lib.config.continue_name || [];
			game.saveConfig('continue_name');
			event.chosen = chosen;
			event.list = [];
			for (const i in lib.character) {
				if (chosen.includes(i) || lib.filter.characterDisabled(i) || event.filter(i) === false) continue;
				event.list.push(i);
			}
			event.list.randomSort();
			const num = 20;
			let list = event.list.slice(0, num);
			const dialog = ui.create.dialog('为AI选择替换的武将【支持中文搜索】', 'hidden', [list, 'characterx']);
			const searchContainer = ui.create.div('.add-setting', {
				margin: '10px 0',
				display: 'flex',
				gap: '8px',
				alignItems: 'center',
				justifyContent: 'center',
				maxWidth: '80%',
				marginLeft: 'auto',
				marginRight: 'auto',
			});
			const extensionBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
				padding: '6px 12px',
				textAlign: 'center',
				marginRight: '8px',
				flexShrink: '0',
			});
			extensionBtn.innerHTML = '<span>扩展</span>';
			const searchInput = ui.create.node('input', {
				type: 'text',
				placeholder: '输入武将中文名搜索',
				style: 'flex:1; padding:6px; border-radius:4px; border:1px solid #ccc; min-width: 200px;',
			});
			const searchBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
				padding: '6px 12px',
				textAlign: 'center',
			});
			searchBtn.innerHTML = '<span>搜索</span>';
			searchContainer.appendChild(extensionBtn);
			searchContainer.appendChild(searchInput);
			searchContainer.appendChild(searchBtn);
			dialog.content.insertBefore(searchContainer, dialog.content.firstChild);
			let currentPackFilter = null;
			const updateCharacterList = (keyword, packFilter = null) => {
				currentPackFilter = packFilter;
				const oldButtons = dialog.content.querySelector('.buttons');
				if (oldButtons) oldButtons.remove();
				let filteredList = event.list;
				if (keyword.trim()) {
					const key = keyword.toLowerCase();
					filteredList = event.list.filter((id) => {
						const name = get.translation(id).toLowerCase();
						return name.includes(key);
					});
				}
				if (packFilter && packFilter !== 'all') {
					const packMap = {};
					for (const pack in lib.characterPack) {
						const chars = Object.keys(lib.characterPack[pack]);
						chars.forEach((charId) => {
							packMap[charId] = pack;
						});
					}
					filteredList = filteredList.filter((id) => packMap[id] === packFilter);
				}
				const displayList = packFilter && packFilter !== 'all' ? filteredList : filteredList.slice(0, 20);
				const newButtons = ui.create.div('.buttons');
				dialog.buttons = ui.create.buttons(displayList, 'characterx', newButtons);
				dialog.content.insertBefore(newButtons, searchContainer.nextSibling);
				newButtons.animate('start');
				game.uncheck();
				game.check();
			};
			extensionBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', async () => {
				const packOverlay = ui.create.div('.add-setting', {
					position: 'fixed',
					top: '0',
					left: '0',
					width: '100%',
					height: '100%',
					backgroundColor: 'rgba(0,0,0,0.8)',
					zIndex: '10000',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
				});
				const packContainer = ui.create.div('.add-setting', {
					backgroundColor: '#333',
					padding: '20px',
					borderRadius: '10px',
					maxWidth: '80%',
					maxHeight: '70%',
					overflowY: 'auto',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '10px',
					justifyContent: 'center',
				});
				const allPacks = Object.keys(lib.characterPack);
				const allBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
					padding: '10px 20px',
					margin: '5px',
					textAlign: 'center',
					backgroundColor: '#555',
					color: 'white',
				});
				allBtn.textContent = '全部';
				allBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', () => {
					packOverlay.remove();
					updateCharacterList(searchInput.value, null);
				});
				packContainer.appendChild(allBtn);
				allPacks.forEach((pack) => {
					const packBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
						padding: '10px 20px',
						margin: '5px',
						textAlign: 'center',
						backgroundColor: '#555',
						color: 'white',
					});
					packBtn.textContent = lib.translate[pack + '_character_config'] || lib.translate[pack] || pack;
					packBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', () => {
						packOverlay.remove();
						updateCharacterList(searchInput.value, pack);
					});
					packContainer.appendChild(packBtn);
				});
				packOverlay.appendChild(packContainer);
				document.body.appendChild(packOverlay);
				packOverlay.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', (e) => {
					if (e.target === packOverlay) {
						packOverlay.remove();
					}
				});
			});
			searchBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', () => {
				updateCharacterList(searchInput.value, currentPackFilter);
			});
			searchInput.addEventListener('keyup', (e) => {
				if (e.key === 'Enter') updateCharacterList(searchInput.value, currentPackFilter);
			});
			const result = await game.me
				.chooseButton(dialog, true)
				.set('onfree', true)
				.set('selectButton', () => {
					return get.config('double_character') ? 2 : 1;
				})
				.forResult();
			dialog.close();
			if (ui.cheat) ui.cheat.close();
			if (ui.cheat2) ui.cheat2.close();
			const sLink0 = _djscSafeLink(result.buttons[0] && result.buttons[0].link);
			const sLink1 = result.buttons[1] ? _djscSafeLink(result.buttons[1].link) : null;
			if (sLink0 && sLink1) {
				target.init(sLink0, sLink1);
				game.addRecentCharacter(sLink0, sLink1);
			} else if (sLink0) {
				target.init(sLink0);
				game.addRecentCharacter(sLink0);
			}
			setTimeout(() => {
				ui.arena.classList.remove('choose-character');
			}, 500);
			event.finish();
		});
	},
	chooseCharacterGuoZhan: function () {
		const target = this;
		const event = game.createEvent('chooseCharacter', false);
		event.target = target;
		event.player = game.me;
		event.setContent(async function () {
			ui.arena.classList.add('choose-character');
			const chosen = lib.config.continue_name || [];
			game.saveConfig('continue_name');
			event.chosen = chosen;
			event.list = [];
			for (const i in lib.character) {
				if (i.indexOf('gz_shibing') === 0 || i.indexOf('key') === 0 || chosen.includes(i) || lib.filter.characterDisabled(i))
					continue;
				event.list.push(i);
			}
			event.list.randomSort();
			const num = 20;
			let list = event.list.slice(0, num);
			const dialog = ui.create.dialog('为AI选择替换的武将【支持中文搜索】', 'hidden', [list, 'character']);
			const searchContainer = ui.create.div('.add-setting', {
				margin: '10px 0',
				display: 'flex',
				gap: '8px',
				alignItems: 'center',
				justifyContent: 'center',
				maxWidth: '80%',
				marginLeft: 'auto',
				marginRight: 'auto',
			});
			const extensionBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
				padding: '6px 12px',
				textAlign: 'center',
				marginRight: '8px',
				flexShrink: '0',
			});
			extensionBtn.innerHTML = '<span>扩展</span>';
			const searchInput = ui.create.node('input', {
				type: 'text',
				placeholder: '输入武将中文名搜索',
				style: 'flex:1; padding:6px; border-radius:4px; border:1px solid #ccc; min-width: 200px;',
			});
			const searchBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
				padding: '6px 12px',
				textAlign: 'center',
			});
			searchBtn.innerHTML = '<span>搜索</span>';
			searchContainer.appendChild(extensionBtn);
			searchContainer.appendChild(searchInput);
			searchContainer.appendChild(searchBtn);
			dialog.content.insertBefore(searchContainer, dialog.content.firstChild);
			let currentPackFilter = null;
			const updateCharacterList = (keyword, packFilter = null) => {
				currentPackFilter = packFilter;
				const oldButtons = dialog.content.querySelector('.buttons');
				if (oldButtons) oldButtons.remove();
				let filteredList = event.list;
				if (keyword.trim()) {
					const key = keyword.toLowerCase();
					filteredList = event.list.filter((id) => {
						const name = get.translation(id).toLowerCase();
						return name.includes(key);
					});
				}
				if (packFilter && packFilter !== 'all') {
					const packMap = {};
					for (const pack in lib.characterPack) {
						const chars = Object.keys(lib.characterPack[pack]);
						chars.forEach((charId) => {
							packMap[charId] = pack;
						});
					}
					filteredList = filteredList.filter((id) => packMap[id] === packFilter);
				}
				const displayList = packFilter && packFilter !== 'all' ? filteredList : filteredList.slice(0, 20);
				const newButtons = ui.create.div('.buttons');
				dialog.buttons = ui.create.buttons(displayList, 'character', newButtons);
				dialog.content.insertBefore(newButtons, searchContainer.nextSibling);
				newButtons.animate('start');
				game.uncheck();
				game.check();
			};
			extensionBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', async () => {
				const packOverlay = ui.create.div('.add-setting', {
					position: 'fixed',
					top: '0',
					left: '0',
					width: '100%',
					height: '100%',
					backgroundColor: 'rgba(0,0,0,0.8)',
					zIndex: '10000',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
				});
				const packContainer = ui.create.div('.add-setting', {
					backgroundColor: '#333',
					padding: '20px',
					borderRadius: '10px',
					maxWidth: '80%',
					maxHeight: '70%',
					overflowY: 'auto',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '10px',
					justifyContent: 'center',
				});
				const allPacks = Object.keys(lib.characterPack);
				const allBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
					padding: '10px 20px',
					margin: '5px',
					textAlign: 'center',
					backgroundColor: '#555',
					color: 'white',
				});
				allBtn.textContent = '全部';
				allBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', () => {
					packOverlay.remove();
					updateCharacterList(searchInput.value, null);
				});
				packContainer.appendChild(allBtn);
				allPacks.forEach((pack) => {
					const packBtn = ui.create.div('.shadowed.reduce_radius.pointerdiv.tdnode', {
						padding: '10px 20px',
						margin: '5px',
						textAlign: 'center',
						backgroundColor: '#555',
						color: 'white',
					});
					packBtn.textContent = lib.translate[pack + '_character_config'] || lib.translate[pack] || pack;
					packBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', () => {
						packOverlay.remove();
						updateCharacterList(searchInput.value, pack);
					});
					packContainer.appendChild(packBtn);
				});
				packOverlay.appendChild(packContainer);
				document.body.appendChild(packOverlay);
				packOverlay.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', (e) => {
					if (e.target === packOverlay) {
						packOverlay.remove();
					}
				});
			});
			searchBtn.addEventListener(lib.config.touchscreen ? 'touchend' : 'click', () => {
				updateCharacterList(searchInput.value, currentPackFilter);
			});
			searchInput.addEventListener('keyup', (e) => {
				if (e.key === 'Enter') updateCharacterList(searchInput.value, currentPackFilter);
			});
			const result = await game.me.chooseButton(dialog, true, 2).set('onfree', true).forResult();
			dialog.close();
			if (ui.cheat) ui.cheat.close();
			if (ui.cheat2) ui.cheat2.close();
			if (result.buttons && result.buttons[0]) {
				const sLink0 = _djscSafeLink(result.buttons[0].link);
				const sLink1 = result.buttons[1] ? _djscSafeLink(result.buttons[1].link) : null;
				if (sLink0 && sLink1) {
					target.init(sLink0, sLink1, false);
					game.addRecentCharacter(sLink0, sLink1);
				} else if (sLink0) {
					target.init(sLink0);
					game.addRecentCharacter(sLink0);
				}
			}
			setTimeout(() => {
				ui.arena.classList.remove('choose-character');
			}, 500);
			event.finish();
		});
	},
};

export { lib };
