import React from "react";

//INTERNAL IMPORT
import { IoIosSearch } from "../../ReactICON/index";
const Header = () => {
  return (
    <>
      <div className="page-titles">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <a href="#">Dashboard</a>
          </li>
          <li className="breadcrumb-item active">
            <a href="#">Appointments</a>
          </li>
        </ol>
      </div>
      <div className="form-head d-flex mb-3 mb-md-4 align-items-center">
        <div className="input-group search-area d-inline-flex me-2">
          <input
            type="text"
            className="form-control"
            placeholder="Search here"
          />
          <div className="input-group-append">
            <button type="button" className="input-group-text">
              <i>
                <IoIosSearch />
              </i>
            </button>
          </div>
        </div>
        <div className="ms-auto">
          <a
            href="#"
            className="btn btn-primary btn-rounded add-appointment"
            data-bs-toggle="modal"
            data-bs-target="#exampleModal"
          >
            + Book Appointment
          </a>
        </div>
      </div>
    </>
  );
};

export default Header;
