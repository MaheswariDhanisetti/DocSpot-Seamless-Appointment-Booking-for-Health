const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Doctor = require("../models/doctorModel");
const User = require("../models/userModel");
const Appointment = require("../models/appointmentModel");
const moment = require("moment");

/* ================= DOCTOR SIGNUP ================= */

exports.doctorSignup = catchAsync(async (req, res, next) => {
  const doctorExists = await Doctor.findOne({ email: req.body.email });

  if (doctorExists) {
    return next(
      new AppError(
        "Doctor already applied. Please contact your admin clinic.",
        400
      )
    );
  }

  const newDoctor = new Doctor({
    ...req.body,
    status: "pending",
  });

  await newDoctor.save();

  const adminUser = await User.findOne({ isAdmin: true });

  if (adminUser) {
    adminUser.unseenNotifications.push({
      type: "new-doctor-request",
      message: `${newDoctor.fullName} has requested to join as a doctor.`,
      data: {
        doctorId: newDoctor._id,
        name: newDoctor.fullName,
      },
      onClickPath: "/admin/doctors",
    });

    await adminUser.save();
  }

  res.status(200).json({
    status: true,
    message: "Doctor account applied successfully",
  });
});

/* ================= GET ALL DOCTORS ================= */

exports.getAllDoctors = catchAsync(async (req, res, next) => {
  const doctors = await Doctor.find();

  res.status(200).json({
    status: true,
    message: "All doctors fetched successfully",
    data: doctors,
  });
});

/* ================= GET APPROVED DOCTORS ================= */

exports.getAllApprovedDoctors = catchAsync(async (req, res, next) => {
  const doctors = await Doctor.find({ status: "approved" });

  res.status(200).json({
    status: true,
    message: "Approved doctors fetched successfully",
    data: doctors,
  });
});

/* ================= GET SINGLE DOCTOR ================= */

exports.getDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ userId: req.params.id });

  if (!doctor) return next(new AppError("Doctor not found", 404));

  res.status(200).json({
    status: true,
    message: "Doctor fetched successfully",
    data: doctor,
  });
});

/* ================= UPDATE DOCTOR ================= */

exports.updateDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOneAndUpdate(
    { userId: req.params.id },
    req.body,
    { new: true }
  );

  if (!doctor) return next(new AppError("Doctor not found", 404));

  res.status(200).json({
    status: true,
    message: "Doctor updated successfully",
    data: doctor,
  });
});

/* ================= CHECK BOOKING AVAILABILITY ================= */

exports.checkBookingAvailability = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ userId: req.body.doctorId });

  if (!doctor) return next(new AppError("Doctor not found", 404));

  // Parse working hours properly (FIXED)
const doctorFromTime = moment(doctor.fromTime, "HH:mm");
const doctorToTime = moment(doctor.toTime, "HH:mm");

// FIXED PARSING
const requestedTime = moment(req.body.time, ["HH:mm", "hh:mm A"]);

const fromTime = requestedTime.clone().subtract(30, "minutes");
const toTime = requestedTime.clone().add(15, "minutes");

const displayFromTime = doctorFromTime.format("hh:mm A");
const displayToTime = doctorToTime.format("hh:mm A");

if (
  requestedTime.isBefore(doctorFromTime) ||
  requestedTime.isAfter(doctorToTime)
) {
  return next(
    new AppError(
      `Please select a time within doctor's working hours ${displayFromTime} to ${displayToTime}`,
      400
    )
  );
}
  // IMPORTANT FIX: keep date as string (since schema stores string)
  const appointments = await Appointment.find({
    doctorId: req.body.doctorId,
    date: req.body.date,
    time: { $gte: fromTime.format("HH:mm"), $lte: toTime.format("HH:mm") },
    status: { $ne: "rejected" },
  });

  if (appointments.length > 0) {
    return next(new AppError("Appointment not available", 400));
  }

  res.status(200).json({
    status: true,
    message: "Appointment available",
  });
});

/* ================= DOCTOR APPOINTMENTS ================= */

exports.doctorAppointments = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findOne({ userId: req.params.id });

  if (!doctor) return next(new AppError("Doctor not found", 404));

  const appointments = await Appointment.find({
    doctorId: doctor.userId,
  });

  res.status(200).json({
    status: true,
    message: "Appointments fetched successfully",
    data: appointments,
  });
});

/* ================= CHANGE APPOINTMENT STATUS ================= */

exports.changeAppointmentStatus = catchAsync(async (req, res, next) => {
  const { appointmentId, status } = req.body;

  const appointment = await Appointment.findByIdAndUpdate(
    appointmentId,
    { status },
    { new: true }
  );

  if (!appointment)
    return next(new AppError("Appointment not found", 404));

  const user = await User.findById(appointment.userId);

  if (user) {
    user.unseenNotifications.push({
      type: "appointment-status-changed",
      message: `Your appointment status has been ${status}`,
      data: {
        name: user.name,
      },
      onClickPath: "/appointments",
    });

    await user.save();
  }

  res.status(200).json({
    status: true,
    message: "Appointment status changed successfully",
  });
});

/* ================= GET BOOKED APPOINTMENTS ================= */

exports.getBookAppointments = catchAsync(async (req, res, next) => {
  const appointments = await Appointment.find({
    doctorId: req.params.id,
    status: "approved",
  });

  res.status(200).json({
    status: true,
    message: "Approved appointments fetched successfully",
    data: appointments,
  });
});