import { StyledEngineProvider, createTheme, ThemeProvider } from '@mui/material/styles';
import React from 'react';

// Create a sleek theme for MUI components to match the ERP style
const muiTheme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // blue-600
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 12,
  },
  components: {
    MuiTextField: {
      defaultProps: {
        size: 'small',
        variant: 'outlined',
      },
    },
  },
});

/**
 * SafeMuiThemeProvider
 * A wrapper that filters out Figma tracking props (data-fg-*) 
 * to prevent Material UI from throwing warnings about unsupported props.
 */
export function SafeMuiThemeProvider(props: any) {
  // We use React.createElement to ensure we are passing ONLY the intended props
  // and preventing any hidden props from being injected by JSX transpilation
  // or environment-level enhancements.
  return React.createElement(
    StyledEngineProvider,
    { injectFirst: true },
    React.createElement(
      ThemeProvider,
      { theme: muiTheme },
      props.children
    )
  );
}
