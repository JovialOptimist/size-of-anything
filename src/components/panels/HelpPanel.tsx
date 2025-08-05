import React, { useState } from "react";
import "../../styles/HelpPanel.css";

/**
 * Panel for help and documentation with interactive collapsible sections
 */
const HelpPanel: React.FC = () => {
  // State for tracking which sections are expanded
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    intro: true, // Default first section to be open
    adding: false,
    dragging: false,
    about: false,
  });

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="panel help-panel">
      <div className="panel-header">
        <h2>Help / About</h2>
      </div>

      {/* Introduction Section - Always visible */}
      <div className="help-intro">
        <p className="welcome-text">
          Welcome to <span className="app-title">The Size of Anything!</span>
        </p>
        <p className="intro-description">
          <ul>
            <li>
              To create your first outline, use the Search tool at the top left
              of the screen.
            </li>
            <li>
              Once created, you can drag the outline by holding down the mouse
              button.
            </li>
          </ul>
        </p>
      </div>

      {/* Collapsible section: Adding Areas */}
      <div className="collapsible-section">
        <div
          className={`section-header ${
            expandedSections.adding ? "expanded" : ""
          }`}
          onClick={() => toggleSection("adding")}
        >
          <h3>Create an outline of a place</h3>
          <span className="toggle-icon">
            {expandedSections.adding ? "−" : "+"}
          </span>
        </div>

        {expandedSections.adding && (
          <div className="section-content">
            <div className="help-method">
              <div className="method-icon text-search"></div>
              <div className="method-content">
                <h4>Text Search</h4>
                <p>
                  Search for a place by name, like "Washington State" or
                  "Central Park". Also works for addresses.
                </p>
              </div>
            </div>

            <div className="help-method">
              <div className="method-icon magic-wand"></div>
              <div className="method-content">
                <h4>Magic Wand</h4>
                <p>
                  Click anywhere on the map to magically select places with no
                  names or smaller features.
                </p>
              </div>
            </div>

            <div className="help-method">
              <div className="method-icon custom-area"></div>
              <div className="method-content">
                <h4>Custom Area</h4>
                <p>
                  Create a square of a specific size. Good if you're like me and
                  have no clue what an "acre" is.
                </p>
              </div>
            </div>

            <div className="help-method">
              <div className="method-icon special-shapes"></div>
              <div className="method-content">
                <h4>Special Shapes</h4>
                <p>
                  Choose from a list of special shapes, like Blue Whales and
                  planes.
                </p>
              </div>
            </div>

            <div className="help-method">
              <div className="method-icon history"></div>
              <div className="method-content">
                <h4>History</h4>
                <p>
                  Re-use any areas you've previously added from your history
                  list.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible section: Dragging Stuff Around */}
      <div className="collapsible-section">
        <div
          className={`section-header ${
            expandedSections.dragging ? "expanded" : ""
          }`}
          onClick={() => toggleSection("dragging")}
        >
          <h3>Drag an outline</h3>
          <span className="toggle-icon">
            {expandedSections.dragging ? "−" : "+"}
          </span>
        </div>

        {expandedSections.dragging && (
          <div className="section-content">
            <div className="tip-card">
              <div className="tip-icon drag-icon"></div>
              <p>
                Once an area is added to the map, you can drag it to relocate it
                for comparison.
              </p>
            </div>

            <div className="tip-card">
              <div className="tip-icon scale-icon"></div>
              <p>
                Areas will maintain their actual size as you move them around
                the map.
              </p>
            </div>

            <div className="tip-card">
              <div className="tip-icon history-icon"></div>
              <p>
                Areas you've added will appear in your history for easy re-use.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible section: basic map controls */}
      <div className="collapsible-section">
        <div
          className={`section-header ${
            expandedSections.mapControls ? "expanded" : ""
          }`}
          onClick={() => toggleSection("mapControls")}
        >
          <h3>Move the map</h3>
          <span className="toggle-icon">
            {expandedSections.mapControls ? "−" : "+"}
          </span>
        </div>

        {expandedSections.mapControls && (
          <div className="section-content">
            <ul>
              <li>
                To zoom in and out, use the scroll wheel or the zoom buttons in
                the bottom right corner.
              </li>
              <li>To move around the map, click and drag the mouse.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Collapsible section: About the developer */}
      <div className="collapsible-section">
        <div
          className={`section-header ${
            expandedSections.about ? "expanded" : ""
          }`}
          onClick={() => toggleSection("about")}
        >
          <h3>About the developer</h3>
          <span className="toggle-icon">
            {expandedSections.about ? "−" : "+"}
          </span>
        </div>

        {expandedSections.about && (
          <div className="section-content about-section">
            <p>
              Hey there! My name is Jac Chambers; I'm an aspiring UX Designer
              and Engineer and a soon-to-be graduate with a Bachelor's Degree in
              Computer Science from the University of Washington, Bothell.
            </p>
            <p>
              The Size of Anything is my capstone project for that degree, and
              it's inspired by my own fascination with scale. For decades we've
              made interactive maps, but they're just zoomable with a tiny ruler
              in the bottom; terrible for actually understanding the size of
              what we're looking at.
            </p>
            <p>
              With the Size of Anything, I'm hoping that some of y'all are able
              to find the same enjoyment I did when I made my first prototype.
              Go put your house in Romania, or steal the Eiffel Tower! The whole
              world is literally for the taking!
            </p>
          </div>
        )}
      </div>

      <div className="collapsible-section">
        <div
          className={`section-header ${
            expandedSections.about ? "expanded" : ""
          }`}
          onClick={() => toggleSection("donate")}
        >
          <h3>Support the site</h3>
          <span className="toggle-icon">
            {expandedSections.donate ? "−" : "+"}
          </span>
        </div>

        {expandedSections.donate && (
          <div className="section-content">
            Well that's mighty kind of you! There will be a link here in the
            future.
          </div>
        )}
      </div>

      <div className="help-footer">
        <p>
          <a
            target="_blank"
            href="https://github.com/JovialOptimist/size-of-anything"
          >
            Jac Chambers | GitHub
          </a>
        </p>
      </div>
    </div>
  );
};

export default HelpPanel;
