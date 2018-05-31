import {
  Alignment,
  Button,
  Classes,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading
} from '@blueprintjs/core';
import * as React from 'react';
import '../../../node_modules/@blueprintjs/core/lib/css/blueprint.css';
import '../../../node_modules/@blueprintjs/icons/lib/css/blueprint-icons.css';
import '../../../node_modules/normalize.css/normalize.css';

class App extends React.Component {
  public render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Manifest Editor</h1>
        </header>
        <Navbar>
          <NavbarGroup align={Alignment.LEFT}>
            <NavbarHeading>Blueprint</NavbarHeading>
            <NavbarDivider />
            <Button className={Classes.MINIMAL} icon="home" text="Home" />
            <Button className={Classes.MINIMAL} icon="document" text="Files" />
          </NavbarGroup>
        </Navbar>
      </div>
    );
  }
}

export default App;
