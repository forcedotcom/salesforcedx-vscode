import { LightningElement, track } from 'lwc';
import { ENTER_KEY, guid } from 'c-utils';

// todo list filters. keys match <a href="#/[key]"> in template.
const FILTERS = {
    all: 'all',
    active: 'active',
    completed: 'completed',
};

function getCurrentFilter() {
    const rawHash = document.location.hash;
    const location = rawHash.replace(/#\//, '');
    return FILTERS[location] || FILTERS.all;
}

export default class Todo extends LightningElement {
    @track todos;
    @track filter;
    has5Todos_today;
    $has5Todos_today;
    
    constructor() {
        super();
        this.filter = getCurrentFilter();
        window.addEventListener('hashchange', () => (
            this.filter = getCurrentFilter()
        ));
    }
    get hasTodos() {
        return !!this.todos.length;
    }

    get filteredTodos() {
        return this.todos.filter(todo => {
            switch (this.filter) {
                case FILTERS.active:
                    return !todo.completed;
                case FILTERS.completed:
                    return todo.completed;
                default:
                    return true;
            }
        });
    }

    get completedTodos() {
        return this.todos.filter(todo => todo.completed);
    }

    get countTodos() {
        return this.activeTodos.length;
    }

    get activeTodos() {
        return this.todos.filter(todo => !todo.completed);
    }

    get isAllTodosCompleted() {
        return this.todos.length === this.completedTodos.length;
    }

    get remainingItemsLabel() {
        return this.countTodos === 1 ? 'item' : 'items';
    }

    get allFilterStyle() {
        return this.filter === FILTERS.all ? 'selected' : '';
    }

    get activeFilterStyle() {
        return this.filter === FILTERS.active ? 'selected' : '';
    }

    get completedFilterStyle() {
        return this.filter === FILTERS.completed ? 'selected' : '';
    }

    setTodos(todos) {
        this.todos = todos;
    }

    addNewTodo(title) {
        if (!title) {
            return;
        }
        const completed = false;
        const key = guid();
        this.setTodos([...this.todos, {
            key, // having a unique key property on iterables is important for diffing
            title,
            completed,
        }]);
    }

    handleKeyDown(evt) {
        if (evt.keyCode !== ENTER_KEY) {
            return;
        }
        const title = (evt.target.value || '').trim();
        evt.target.value = '';
        evt.preventDefault();
        this.addNewTodo(title);
    }

    handleTodoRemove({ target }) {
        this.setTodos(this.todos.filter(todo => todo !== target.todo));
    }

    handleTodoUpdate(evt) {
        const key = evt.target.todo.key;
        const todos = this.todos.map(todo => {
            if (todo.key === key) {
                return Object.assign({}, todo, evt.detail);
            }
            return todo;
        });
        this.setTodos(todos);
    }

    handleToggleAll({ target }) {
        this.setTodos(this.todos.map(todo => (
            Object.assign({}, todo, { completed: target.checked })
        )));
    }

    handleClearCompleted() {
        this.setTodos(this.todos.filter(todo => !todo.completed));
    }
}