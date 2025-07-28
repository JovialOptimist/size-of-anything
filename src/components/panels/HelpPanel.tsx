import React from "react";

/**
 * Panel for help and documentation
 */
const HelpPanel: React.FC = () => {
  return (
    <div className="panel help-panel">
      <h2>Help</h2>
      {/* Help content will go here */}
      <p>Welcome to the Size of Anything tool!</p>
      <p>Use the sidebar to access different functionalities:</p>
      <ul>
        <li>
          <strong>Text Search:</strong> Search for specific text within the
          content.
        </li>
        <li>
          <strong>Magic Wand:</strong> Click to select a place on the screen.
        </li>
        <li>
          <strong>Custom Area:</strong> Define a custom area for measurement.
        </li>
        <li>
          <strong>History:</strong> View your recent actions and measurements.
        </li>
      </ul>
      <p>
        For more detailed instructions, refer to the documentation or contact
        support.
      </p>
      <p>Happy measuring!</p>
    </div>
  );
};

export default HelpPanel;
