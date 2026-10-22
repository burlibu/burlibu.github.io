console.clear();

gsap.registerPlugin(Flip);

const bentoContainer = document.querySelector(".bento-container");
const bentoItems = bentoContainer.querySelectorAll("[data-row]");
const rowClasses = ["rows-3-1-1", "rows-1-3-1", "rows-1-1-3"];
const colClasses = ["cols-3-1-1", "cols-1-3-1", "cols-1-1-3"];
// Remember 0 index for the classes array, same for the data attribute on the HTML elements
let activeColumn = 1,
  activeRow = 1,
  doFlip = false;

bentoItems.forEach((e, i) => {
  const colNumber = e.dataset.column;
  const rowNumber = e.dataset.row;
  e.addEventListener("mouseenter", () => {
    // console.log("Item", i, "column", colNumber, "row", rowNumber);
    const state = Flip.getState(bentoItems);
    if (colNumber !== activeColumn) {
      bentoContainer.classList.remove(colClasses[activeColumn]);
      bentoContainer.classList.add(colClasses[colNumber]);
      activeColumn = colNumber;
      doFlip = true;
    }
    if (rowNumber !== activeRow) {
      bentoContainer.classList.remove(rowClasses[activeRow]);
      bentoContainer.classList.add(rowClasses[rowNumber]);
      activeRow = rowNumber;
      doFlip = true;
    }
    doFlip &&
      Flip.from(state, {
        duration: 0.4,
        ease: "power2.out",
        onStart: () => (doFlip = false),
        absolute: true
      });
  });
});

bentoContainer.addEventListener("mouseleave", () => {
  // Toggle the boolean just in case
  doFlip = true;
  // Get the state
  const state = Flip.getState(bentoItems);

  // Update the classes in the container
  bentoContainer.classList.remove(colClasses[activeColumn]);
  bentoContainer.classList.remove(rowClasses[activeRow]);
  bentoContainer.classList.add(colClasses[1]);
  bentoContainer.classList.add(rowClasses[1]);

  // Update the index values
  activeColumn = 1;
  activeRow = 1;

  // Run the Flip Animation
  Flip.from(state, {
    duration: 0.4,
    ease: "power2.out",
    onStart: () => (doFlip = false),
    absolute: true
  });
});
