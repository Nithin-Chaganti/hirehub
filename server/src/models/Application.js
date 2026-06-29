import mongoose from 'mongoose';

const { Schema } = mongoose;

const APPLICATION_STATUSES = [
  'pending',
  'reviewing',
  'shortlisted',
  'accepted',
  'rejected',
];

const applicationSchema = new Schema(
  {
    candidate: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Candidate is required'],
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job is required'],
    },
    status: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: 'Invalid application status',
      },
      default: 'pending',
    },
    coverLetter: {
      type: String,
      trim: true,
    },
    resumeUrl: {
      type: String,
      trim: true,
    },
    resumeSnapshot: {
    url: String,
    publicId: String,
    uploadedAt: Date,
},
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    matchScore: {
      type: Number,
      min: [0, 'Match score cannot be negative'],
      max: [100, 'Match score cannot exceed 100'],
    },
  },
  { timestamps: true }
);

applicationSchema.index({ candidate: 1, job: 1 }, { unique: true });
applicationSchema.index({ candidate: 1 });
applicationSchema.index({ job: 1 });
applicationSchema.index({ job: 1, status: 1 });

const Application = mongoose.model('Application', applicationSchema);

export default Application;
