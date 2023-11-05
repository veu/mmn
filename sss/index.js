const cells = readPuzzleFromUrl()

const initialize = async () => {
	const domCells = document.querySelectorAll('td');
	domCells.forEach((cell, i) => {
		cell.setAttribute('class', cells[i] ? 'filled' : '');
		cell.onclick = async ({target: cell}) => {
			cells[i] = 1 - cells[i];
			cell.setAttribute('class', cells[i] ? 'filled' : '');
			solve();
		}
	});

	solve();
}

async function main(hints) {
	const lp = `
% define dimensions
x(1..15).
y(1..10).

% define hints
${hints}

% place blocks
1 { row_block(Y, N, X1, X2) : L = X2 - X1 + 1, x(X1), x(X2) } 1 :- row(Y, N, L).
1 { col_block(X, N, Y1, Y2) : L = Y2 - Y1 + 1, y(Y1), y(Y2) } 1 :- col(X, N, L).

% ensure blocks are at least one cell apart
:- row_block(Y, N, _, X1), row_block(Y, N + 1, X2, _), X1 + 1 >= X2.
:- col_block(X, N, _, Y1), col_block(X, N + 1, Y2, _), Y1 + 1 >= Y2.

% mark filled cells for rows
L { row_mark(X, Y) : X >= X1, X <= X2, x(X) } L :- row_block(Y, N, X1, X2), row(Y, N, L).
% mark filled cells for columns
L { col_mark(X, Y) : Y >= Y1, Y <= Y2, y(Y) } L :- col_block(X, N, Y1, Y2), col(X, N, L).

% fill only cells that have both marks
cell(X, Y) :- row_mark(X, Y), col_mark(X, Y).
% disallow only one mark on a cell
:- row_mark(X, Y), not col_mark(X, Y).
:- col_mark(X, Y), not row_mark(X, Y).

#show cell/2.`;
	const domResult = document.querySelector('.result');

	domResult.innerHTML = '<span><span>❓</span><span>loading</span></span>';
	await clingo.init("https://cdn.jsdelivr.net/npm/clingo-wasm@0.1.1/dist/clingo.wasm");
	const result = await clingo.run(lp, 0)
	if (!result.Error) {
		models = []
		const witnesses = result.Call[0].Witnesses
		witnesses.forEach((witness) => {
			models.push(witness.Value)
		});
		domResult.innerHTML = models.length == 1 ? '<span><span>✅</span><span>solvable</span></span>' : '<span><span>❌</span><span>unsolvable</span></span>';
	}
}

function readPuzzleFromUrl() {
	if (window.location.hash && window.location.hash.match(/^#[01]{150}$/)) {
		return window.location.hash.slice(1).split('').map(n=>+n);
	}
	const puzzle = createZeroArray()
	if (window.location.hash && window.location.hash.match(/^#[0-7]{50}$/)) {
		window.location.hash.slice(1).split('').forEach((l, i) => {
				puzzle[i * 3] = +l & 1;
				puzzle[i * 3 + 1] = (l >> 1) & 1;
				puzzle[i * 3 + 2] = (l >> 2) & 1;
		})
	}
	return puzzle
}

function updatePuzzleInUrl() {
	let hash = '#';
	for(let i = 0; i < 150; i += 3) {
		hash += cells[i] | (cells[i + 1] << 1) | (cells[i + 2] << 2);
	}
	history.replaceState(null, null, hash);
}

async function solve() {
	addColNumbers(createColNumbers(cells));
	addRowNumbers(createRowNumbers(cells));
	await main(compileHints());
	addStats(compileStats(models), models.length);
	updatePuzzleInUrl();
}

function createColNumbers(cells) {
	colNumbers = []
	for (let x = 0; x < 15; x++) {
		const column = [];
		let current = 0;
		for (let y = 0; y < 10; y++) {
			if (cells[x + y * 15]) {
				current++;
			} else if (current > 0) {
				column.push(current)
				current = 0;
			}
		}
		if (current > 0) {
			column.push(current);
		}
		colNumbers.push(column);
	}
	return colNumbers;
}

function addColNumbers(colNumbers) {
	const domNumbers = document.querySelectorAll('th.top')
	domNumbers.forEach((numbers, x) => {
		numbers.innerHTML = `<span><span>${colNumbers[x].length ? colNumbers[x].join('<br>') : '0'}</span></span>`;
	})
}

function createRowNumbers(cells) {
	rowNumbers = []
	for (let y = 0; y < 10; y++) {
		const row = [];
		let current = 0;
		for (let x = 0; x < 15; x++) {
			if (cells[x + y * 15]) {
				current++;
			} else if (current > 0) {
				row.push(current)
				current = 0;
			}
		}
		if (current > 0) {
			row.push(current)
		}
		rowNumbers.push(row);
	}
	return rowNumbers;
}

function addRowNumbers(rowNumbers) {
	const domNumbers = document.querySelectorAll('th.left')
	domNumbers.forEach((numbers, y) => {
		numbers.innerHTML = `<span><span>${rowNumbers[y].length ? rowNumbers[y].join(' ') : '0'}</span></span>`;
	})
}

function compileHints() {
	let hints = ''
	for (let x = 0; x < 15; x++) {
		colNumbers[x].forEach((number, i) => {
			hints += `col(${x + 1}, ${i + 1}, ${number}). `
		});
	}
	for (let y = 0; y < 10; y++) {
		rowNumbers[y].forEach((number, i) => {
			hints += `row(${y + 1}, ${i + 1}, ${number}). `
		});
	}
	return hints;
}

function compileStats(models) {
	const stats = createZeroArray(150);
	models.forEach((model) => {
		model.forEach((fact) => {
			const r = fact.match(/cell\((\d+),(\d+)\)/)
			const i = (r[1] - 1) + (r[2] - 1) * 15;
			stats[i]++;
		});
	});
	return stats
}

function addStats(stats, numModels) {
	const domCells = document.querySelectorAll('td')
	domCells.forEach((cell, i) => {
		cell.setAttribute('class', [
			cells[i] ? 'filled' : null,
			stats[i] == 0 || stats[i] == numModels ? null : 'err',
		].filter(a=>a).join(' '))
	});
}

function createZeroArray() {
	const arr = new Array(150);
	for (let i = 0; i < 150; i++) {
		arr[i] = 0;
	}
	return arr
}
