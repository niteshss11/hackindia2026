import React from "react";

const Link = ({ name, handleClick }) => {
  return (
    <li>
      <a
        href="#"
        onClick={(event) => {
          event.preventDefault();
          handleClick();
        }}
      >
        {name}
      </a>
    </li>
  );
};

export default Link;
