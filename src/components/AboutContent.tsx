/**
 * About content for Right Sidebar: app blurb, Support the site, About the developer, GitHub.
 */
import "./AboutContent.css";

export default function AboutContent() {
  return (
    <div className="about-content">
      <section className="about-section">
        <h3>About The Size of Anything</h3>
        <p>
          The Size of Anything lets you compare the sizes of different areas on a map. Search for
          a place (like Disneyland or Central Park), and the real outline from OpenStreetMap is
          shown. You can drag it anywhere to compare with other areas. Use the search box to find
          places by name, the magic wand to click on the map and find features at that spot, custom
          shapes for a given area or length, or your history to place something you&apos;ve used before.
        </p>
      </section>

      <section className="about-section">
        <h3>Support the site</h3>
        <p>
          Well that&apos;s mighty kind of you! If you want to help out, you can check out my{" "}
          <a href="https://buymeacoffee.com/thesizeofanything" target="_blank" rel="noopener noreferrer">
            buy me a coffee page
          </a>
          .
        </p>
      </section>

      <section className="about-section">
        <h3>About the developer</h3>
        <p>
          Hey there! My name is Jac Chambers; I&apos;m an aspiring UX Designer and Engineer and a
          soon-to-be graduate with a Bachelor&apos;s Degree in Computer Science from the University of
          Washington, Bothell.
        </p>
        <p>
          The Size of Anything is my capstone project for that degree, and it&apos;s inspired by my
          own fascination with scale. For decades we&apos;ve made interactive maps, but they&apos;re just
          zoomable with a tiny ruler in the bottom; terrible for actually understanding the size of
          what we&apos;re looking at.
        </p>
        <p>
          With the Size of Anything, I&apos;m hoping that some of y&apos;all are able to find the same
          enjoyment I did when I made my first prototype. Go put your house in Romania, or steal the
          Eiffel Tower! The whole world is literally for the taking!
        </p>
      </section>

      <section className="about-section about-footer">
        <a
          href="https://github.com/JovialOptimist/size-of-anything"
          target="_blank"
          rel="noopener noreferrer"
        >
          Jac Chambers | GitHub
        </a>
      </section>
    </div>
  );
}
