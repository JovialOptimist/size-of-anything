# Theming in Size of Anything

This application supports both light and dark themes, along with system preference detection.

## Theme Options

Users can choose between three theme options in the settings panel:

1. **Light Theme** - Default light color scheme
2. **Dark Theme** - Dark color scheme for low-light environments
3. **System** - Automatically switches between light and dark themes based on the user's system preferences

## Implementation Details

The theme system works as follows:

- Theme preferences are stored in `localStorage` for persistence between sessions
- CSS variables in `globals.css` define color schemes for both light and dark modes
- The `.dark-mode` class is applied to the root HTML element when dark mode is active
- Map components (Leaflet) have special dark mode styling in `mapDarkMode.css`
- The settings panel provides a user interface for selecting themes

## Extending the Theme System

To add new themed components:

1. Add CSS variables for the component in both light and dark mode sections in `globals.css`
2. Use these variables instead of hard-coded colors in your component's styles
3. Test both light and dark appearances

## Theme-aware Component Development

When creating new components, follow these guidelines:

- Use CSS variables for all colors and UI elements
- Test components in both light and dark modes
- Consider high contrast needs for accessibility
- Avoid hard-coding colors directly in component styles

## CSS Structure for Dark Mode

The dark mode implementation uses these CSS files:

1. `globals.css` - Contains the base CSS variables for both light and dark themes
2. `darkModeOverrides.css` - Contains specific overrides for components in dark mode
3. Component-specific CSS files - Use variables from globals.css where possible

When the `.dark-mode` class is applied to the root HTML element, all the dark mode styles take effect.