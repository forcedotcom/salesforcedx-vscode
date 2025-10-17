const STORAGE_KEY = 'todos';

export function load() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

export function save(todos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}