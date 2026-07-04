import React from "react";

const Header = ({ setOpenComponent }) => {
  return (
    <>
      <div className="page-titles">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <a href="#">Dashboard</a>
          </li>
          <li className="breadcrumb-item active">
            <a href="#">Profile</a>
          </li>
        </ol>
      </div>
    </>
  );
};

export default Header;
