/* eslint-disable @lwc/lwc/prefer-custom-event */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @lwc/lwc/no-inner-html */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { createElement } from 'lwc';
import CustomSelect from './customSelect';

describe('Custom Select', () => {
  let customSelect;

  // Common strings
  const OPTION_FOO = 'Foo';
  const OPTION_BAR = 'Bar';
  const OPTION_BAZ = 'Baz';
  const PLACEHOLDER = 'placeholder';
  const ARIA_HIDDEN = 'aria-hidden';
  const DATA_OPTION_VALUE = 'data-option-value';
  const OPTION_HIGHLIGHT = 'option--highlight';
  const EVENT_OPTION_SELECTION = 'option__selection';
  const EVENT_KEYDOWN = 'keydown';
  const EVENT_INPUT = 'input';
  const CUSTOM_SELECT_EVENT_NAME = 'customselect__optionsopened';
  const OPTIONS_OPEN_CLASS = 'options--open';

  // Query Helpers
  const getInputSearchBar = () => {
    return customSelect.shadowRoot.querySelector('input[name=search-bar]');
  };
  const getOptionsWrapper = () => {
    return customSelect.shadowRoot.querySelector('.options__wrapper');
  };
  const getClearSearch = () => {
    return customSelect.shadowRoot.querySelector('.select__clear-search');
  };
  const getDropdownTrigger = () => {
    return customSelect.shadowRoot.querySelector('[data-el-chevron]');
  };

  beforeEach(() => {
    customSelect = createElement('querybuilder-custom-select', {
      is: CustomSelect
    });
    customSelect.allOptions = [OPTION_FOO, OPTION_BAR, OPTION_BAZ];
    customSelect.selectedOptions = [];
    customSelect.multiple = true;
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  describe('UI RENDERING', () => {
    it('should alert user when loading', async () => {
      document.body.appendChild(customSelect);
      expect(customSelect.isLoading).toEqual(false);
      let searchBar = getInputSearchBar();
      expect(searchBar.getAttribute(PLACEHOLDER).toLowerCase()).not.toContain(
        'loading'
      );

      customSelect.isLoading = true;
      return Promise.resolve().then(() => {
        searchBar = getInputSearchBar();
        expect(customSelect.isLoading).toEqual(true);
        expect(searchBar.getAttribute(PLACEHOLDER).toLowerCase()).toContain(
          'loading'
        );
        customSelect.isLoading = false;
      });
    });

    it('should use placeholder api', () => {
      document.body.appendChild(customSelect);
      const exampleText = 'hold my beer';
      const searchBar = getInputSearchBar();
      expect(searchBar.getAttribute(PLACEHOLDER)).toBe('');

      customSelect.placeholderText = exampleText;
      return Promise.resolve().then(() => {
        expect(searchBar.getAttribute(PLACEHOLDER)).toBe(exampleText);
        const classList = Array.from(searchBar.classList);

        expect(classList).not.toContain('select__input-placeholder--fadeout');
      });
    });

    it('should style the placeholder text when input has focus', () => {
      document.body.appendChild(customSelect);
      customSelect.placeholderText = 'hold my beer';
      const searchBar = getInputSearchBar();
      searchBar.focus();
      return Promise.resolve().then(() => {
        const classList = Array.from(searchBar.classList);
        expect(classList).toContain('select__input-placeholder--fadeout');
      });
    });

    it('should NOT display the options wrapper by default', () => {
      document.body.appendChild(customSelect);
      const optionsList = getOptionsWrapper();

      expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('true');
    });

    it('should display the options wrapper when input is clicked', () => {
      document.body.appendChild(customSelect);
      const searchBar = getInputSearchBar();
      searchBar.click();
      return Promise.resolve().then(() => {
        const optionsList = getOptionsWrapper();
        expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
      });
    });

    it('should fire a custom event when the options are opened', () => {
      document.body.appendChild(customSelect);
      const handler = jest.fn();
      document.addEventListener(CUSTOM_SELECT_EVENT_NAME, handler);
      const searchBar = getInputSearchBar();
      searchBar.click();
      return Promise.resolve().then(() => {
        expect(handler).toBeCalled();
        expect(handler.mock.calls[0][0].detail.target).toEqual(searchBar);
      });
    });

    it('should only allow ONE options menu to be open at a time', () => {
      document.body.appendChild(customSelect);
      const searchBar = getInputSearchBar();
      const optionsWrapper = getOptionsWrapper();
      let optionsWrapperClassList;
      let optionsOpenEvent;
      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsWrapperClassList = Array.from(optionsWrapper.classList);
          expect(optionsWrapperClassList).toContain(OPTIONS_OPEN_CLASS);
          optionsOpenEvent = new CustomEvent(CUSTOM_SELECT_EVENT_NAME, {
            detail: {
              target: searchBar
            },
            bubbles: true,
            composed: true
          });
          customSelect.dispatchEvent(optionsOpenEvent);
        })
        .then(() => {
          optionsWrapperClassList = Array.from(optionsWrapper.classList);
          expect(optionsWrapperClassList).toContain(OPTIONS_OPEN_CLASS);

          const newInput = document.createElement('input');
          optionsOpenEvent = new CustomEvent(CUSTOM_SELECT_EVENT_NAME, {
            detail: {
              target: newInput
            },
            bubbles: true,
            composed: true
          });
          customSelect.dispatchEvent(optionsOpenEvent);
        })
        .then(() => {
          optionsWrapperClassList = Array.from(optionsWrapper.classList);
          expect(optionsWrapperClassList).not.toContain(OPTIONS_OPEN_CLASS);
        });
    });

    it('should close the list of options with document click event', () => {
      let optionsList;
      document.body.appendChild(customSelect);
      const searchBar = getInputSearchBar();
      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
          document.dispatchEvent(new Event('click'));
        })
        .then(() => {
          optionsList = getOptionsWrapper();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('true');
        });
    });

    it('should reset the search bar when X is clicked', () => {
      let optionsList;
      let clearSearchBtn;
      document.body.appendChild(customSelect);
      const searchBar = getInputSearchBar();
      clearSearchBtn = getClearSearch();
      expect(searchBar.value).toBe('');
      expect(clearSearchBtn).toBeNull();

      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
          searchBar.value = OPTION_FOO;
          searchBar.dispatchEvent(new Event(EVENT_INPUT));
        })
        .then(() => {
          clearSearchBtn = getClearSearch();
          expect(clearSearchBtn).not.toBeNull();
          expect(searchBar.value).toBe(OPTION_FOO);

          clearSearchBtn.click();
        })
        .then(() => {
          optionsList = getOptionsWrapper();
          clearSearchBtn = getClearSearch();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('true');
          expect(searchBar.value).toBe('');
          expect(clearSearchBtn).toBeNull();
        });
    });

    describe('Single Select Mode', () => {
      beforeEach(() => {
        customSelect.multiple = false;
      });
      /*
      During testing the getter for the displayValue() is called once
      & before the renderedCallback that caches the inputSelectEl.
      The only way I have been able to trigger another render of the component
      is to click the search bar.
       */
      it('should display the selected option as the value', () => {
        customSelect.selectedOptions = [OPTION_FOO];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(false);
        const searchBar = getInputSearchBar();
        searchBar.click();
        return Promise.resolve().then(() => {
          expect(searchBar.value).toBe(OPTION_FOO);
          expect(customSelect.value[0]).toBe(OPTION_FOO);
        });
      });

      it('should display only ONE selected option as the value', () => {
        customSelect.selectedOptions = [OPTION_FOO, OPTION_BAZ];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(false);
        const searchBar = getInputSearchBar();
        searchBar.click();
        return Promise.resolve().then(() => {
          expect(searchBar.value).toBe(OPTION_FOO);
        });
      });

      it('should select the text in the input when clicked', () => {
        customSelect.selectedOptions = [OPTION_FOO];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(false);
        const searchBar = getInputSearchBar();
        const selectSpy = jest.spyOn(searchBar, 'select');
        searchBar.click();
        return Promise.resolve().then(() => {
          expect(selectSpy).toHaveBeenCalled();
        });
      });

      it('should select the text in the input when toggle chevron clicked', () => {
        customSelect.selectedOptions = [OPTION_FOO];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(false);
        const dropdownTrigger = getDropdownTrigger();
        const searchBar = getInputSearchBar();
        const selectSpy = jest.spyOn(searchBar, 'select');
        dropdownTrigger.click();
        return Promise.resolve().then(() => {
          expect(selectSpy).toHaveBeenCalled();
        });
      });
    });
    describe('Multiple Selection Mode', () => {
      it('should NOT display the selected options as input value', () => {
        customSelect.selectedOptions = [OPTION_FOO];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(true);
        const searchBar = getInputSearchBar();
        expect(searchBar.value).toBe('');
        expect(customSelect.value[0]).toBe(OPTION_FOO);
      });
      it('should set the value to match multiple selections from the model', () => {
        customSelect.selectedOptions = [OPTION_FOO, OPTION_BAR, OPTION_BAZ];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(true);
        const searchBar = getInputSearchBar();
        expect(searchBar.value).toBe('');
        expect(customSelect.value).toBe(customSelect.selectedOptions);
      });
      it('should focus the cursor in the input when toggle chevron clicked', () => {
        customSelect.selectedOptions = [OPTION_FOO];
        document.body.appendChild(customSelect);
        expect(customSelect.multiple).toBe(true);
        const dropdownTrigger = getDropdownTrigger();
        const searchBar = getInputSearchBar();
        const focusSpy = jest.spyOn(searchBar, 'focus');
        dropdownTrigger.click();
        return Promise.resolve().then(() => {
          expect(focusSpy).toHaveBeenCalled();
        });
      });
    });

    describe('Dropdown Arrow', () => {
      it('should toggle the options menu when clicked, with directional arrow', () => {
        document.body.appendChild(customSelect);
        const dropDownArrow = customSelect.shadowRoot.querySelector(
          'div.select__dropdown-arrow'
        );
        const optionsList = getOptionsWrapper();
        let classList;
        expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('true');

        classList = Array.from(dropDownArrow.classList);
        expect(classList).not.toContain('select__dropdown-arrow--up');

        dropDownArrow.click();
        return Promise.resolve()
          .then(() => {
            classList = Array.from(dropDownArrow.classList);
            expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
            expect(classList).toContain('select__dropdown-arrow--up');
            dropDownArrow.click();
          })
          .then(() => {
            classList = Array.from(dropDownArrow.classList);
            expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('true');
            expect(classList).not.toContain('select__dropdown-arrow--up');
          });
      });
    });
  });
  describe('OPTIONS', () => {
    let searchBar;

    beforeEach(() => {
      document.body.appendChild(customSelect);
      searchBar = getInputSearchBar();
      // clear search bar value
      searchBar.value = '';
      searchBar.dispatchEvent(new Event(EVENT_INPUT));
    });

    afterEach(() => {
      // close the options list to reset
      document.dispatchEvent(new Event('click'));
    });

    it('should render a list of options', () => {
      searchBar.click();
      return Promise.resolve().then(() => {
        const optionsList = getOptionsWrapper();

        expect(optionsList.children.length).toBe(
          customSelect.allOptions.length
        );

        for (const option of customSelect.allOptions) {
          expect(optionsList.innerHTML).toContain(option);
        }
      });
    });

    it('should only display options not already selected', () => {
      customSelect.selectedOptions = [OPTION_FOO];

      searchBar.click();
      return Promise.resolve().then(() => {
        const optionsList = getOptionsWrapper();

        expect(optionsList.children.length).toBe(
          customSelect.allOptions.length - customSelect.selectedOptions.length
        );

        expect(optionsList.innerHTML).not.toContain(OPTION_FOO);
      });
    });

    it('should ignore character case of selected options', () => {
      customSelect.selectedOptions = ['foo', 'bar'];

      searchBar.click();
      return Promise.resolve().then(() => {
        const optionsList = getOptionsWrapper();

        expect(optionsList.children.length).toBe(
          customSelect.allOptions.length - customSelect.selectedOptions.length
        );
        expect(optionsList.innerHTML).not.toContain(OPTION_FOO);
        expect(optionsList.innerHTML).not.toContain(OPTION_BAR);
      });
    });

    it('should show options that match a user search case insensitive', () => {
      let optionsList;

      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();

          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
          expect(optionsList.children.length).toBe(
            customSelect.allOptions.length
          );
          searchBar.value = 'foo';
          searchBar.dispatchEvent(new Event(EVENT_INPUT));
        })
        .then(() => {
          expect(optionsList.children.length).toBe(1);
          const optionValue =
            optionsList.firstChild.getAttribute(DATA_OPTION_VALUE);
          expect(optionValue).toBe(OPTION_FOO);
        });
    });

    it('should let the user know where there are no search results', () => {
      let optionsList;

      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
          expect(optionsList.children.length).toBe(
            customSelect.allOptions.length
          );
          searchBar.value = 'no match';
          searchBar.dispatchEvent(new Event(EVENT_INPUT));
        })
        .then(() => {
          expect(optionsList.children.length).toBe(1);
          expect(optionsList.firstChild.classList).toContain(
            'option--disabled'
          );
          expect(optionsList.firstChild.innerHTML).toContain('No results');
        });
    });

    it('should fire a selection event & set value when selection is made', () => {
      const handler = jest.fn();
      customSelect.addEventListener(EVENT_OPTION_SELECTION, handler);

      searchBar.click();
      return Promise.resolve().then(() => {
        const optionsList = getOptionsWrapper();
        const firstOption = optionsList.firstChild;
        const optionValue = firstOption.getAttribute(DATA_OPTION_VALUE);
        expect(customSelect.value[0]).toBe(undefined);
        firstOption.click();

        expect(handler).toHaveBeenCalled();
        expect(handler.mock.calls[0][0].detail.value).toEqual(optionValue);
        expect(customSelect.value[0]).toBe(optionValue);
      });
    });
  });

  describe('KEYBOARD EVENTS', () => {
    let mockScrollIntoView;
    let searchBar;

    beforeEach(() => {
      mockScrollIntoView = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
      document.body.appendChild(customSelect);
      searchBar = getInputSearchBar();
      // clear search bar value
      searchBar.value = '';
      searchBar.dispatchEvent(new Event(EVENT_INPUT));
    });

    afterEach(() => {
      // close the options list to reset
      document.dispatchEvent(new Event('click'));
    });

    it('should NOT have any highlight options when opened', () => {
      searchBar.click();
      return Promise.resolve().then(() => {
        const optionsList = getOptionsWrapper();

        for (const option of optionsList.children) {
          expect(option.classList).not.toContain(OPTION_HIGHLIGHT);
        }
      });
    });

    it('should allow navigation with DOWN ARROW', () => {
      let firstOption;
      let optionsList;
      // open the list of options
      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          firstOption = optionsList.firstChild;
          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'ArrowDown' })
          );
        })
        .then(() => {
          expect(firstOption.classList).toContain(OPTION_HIGHLIGHT);
          expect(mockScrollIntoView).toHaveBeenCalled();

          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'ArrowDown' })
          );
        })
        .then(() => {
          // only the second option should should be highlighted
          expect(firstOption.classList).not.toContain(OPTION_HIGHLIGHT);
          expect(optionsList.children[1].classList).toContain(OPTION_HIGHLIGHT);
        });
    });

    it('should allow navigation with UP ARROW', () => {
      let lastOption;
      let optionsList;
      // open the list of options
      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          lastOption = optionsList.lastChild;
          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'ArrowUp' })
          );
        })
        .then(() => {
          expect(lastOption.classList).toContain(OPTION_HIGHLIGHT);
          expect(mockScrollIntoView).toHaveBeenCalled();

          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'ArrowUp' })
          );
        })
        .then(() => {
          // only the second to last option should should be highlighted
          expect(lastOption.classList).not.toContain(OPTION_HIGHLIGHT);
          const secondToLastIndex = optionsList.children.length - 2;
          expect(optionsList.children[secondToLastIndex].classList).toContain(
            OPTION_HIGHLIGHT
          );
        });
    });

    it('should allow option selection with ENTER', () => {
      let firstOption;
      let optionsList;
      const handler = jest.fn();
      customSelect.addEventListener(EVENT_OPTION_SELECTION, handler);
      // open the list of options
      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          firstOption = optionsList.firstChild;
          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'ArrowDown' })
          );
        })
        .then(() => {
          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'Enter' })
          );
          const optionValue = firstOption.getAttribute(DATA_OPTION_VALUE);
          firstOption.click();

          expect(handler).toHaveBeenCalled();
          expect(handler.mock.calls[0][0].detail.value).toEqual(optionValue);
        });
    });

    it('should close options list with ESCAPE', () => {
      let optionsList;
      searchBar.click();
      return Promise.resolve()
        .then(() => {
          optionsList = getOptionsWrapper();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('false');
          searchBar.dispatchEvent(
            new KeyboardEvent(EVENT_KEYDOWN, { key: 'Escape' })
          );
        })
        .then(() => {
          optionsList = getOptionsWrapper();
          expect(optionsList.getAttribute(ARIA_HIDDEN)).toBe('true');
        });
    });
  });
});
