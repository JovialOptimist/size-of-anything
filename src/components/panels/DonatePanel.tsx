import React from "react";

/**
 * Panel for donation options
 */
const DonatePanel: React.FC = () => {
  return (
    <div className="panel donate-panel">
      <h2>Donate</h2>
      {/* Donation options and information will go here */}
      <p>
        If you find this tool useful, consider supporting its development with a
        donation.
      </p>
      <button className="donate-button">Donate Now</button>
    </div>
  );
};

export default DonatePanel;
