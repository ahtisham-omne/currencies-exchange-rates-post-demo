import { StyledEngineProvider, createTheme, ThemeProvider } from '@mui/material/styles';
import React from 'react';
import { palette } from '@/styles/tokens';

// MUI theme — primary mirrors the Omne design-system primary
// (palette.blue[500] = #0A77FF) so MUI surfaces match the rest of the app.
const muiTheme = createTheme({
  palette: {
    primary: {
      main: palette.blue[500],   // #0A77FF
      dark: palette.blue[600],   // #0862D4 — partner-spec hover blue
      light: palette.blue[400],  // #60A5FA
      contrastText: palette.white,
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
