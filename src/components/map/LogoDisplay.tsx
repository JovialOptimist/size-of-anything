import React from 'react';
import logo from '../../assets/sizeofanythinglogo.png';
import '../../styles/LogoDisplay.css';

const LogoDisplay: React.FC = () => {
  return (
    <div className="logo-display">
      <img src={logo} alt="Size of Anything Logo" />
    </div>
  );
};

export default LogoDisplay;