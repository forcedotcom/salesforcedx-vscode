import { createElement } from 'lwc';
import DemoLwcComponent from 'c/demoLwcComponent';

describe('Demo Lwc Component', () => {
  afterEach(() => {
    // The jsdom instance is shared across test cases in a single file so reset the DOM
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it('Displays greeting', () => {
    const element = createElement('demo-lwc-component', {
      is: DemoLwcComponent
    });
    document.body.appendChild(element);
    const div = element.shadowRoot.querySelector('div');
    expect(div.textContent).toBe('Hello, World!');
  });

  it('Failed test', () => {
    expect(1).toEqual(2);
  });
});
