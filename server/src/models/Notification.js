import mongoose from 'mongoose';

const { Schema } = mongoose;

const NOTIFICATION_TYPES = [
  'new_application',
  'application_status',
  'job_closed',
];

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: NOTIFICATION_TYPES,
        message: 'Invalid notification type',
      },
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [100, 'Notification title cannot exceed 100 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Notification message cannot exceed 500 characters'],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedJob: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
    },
    relatedApplication: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
// In models/Notification.js, add these indexes:


const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
