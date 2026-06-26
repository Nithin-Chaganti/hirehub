import mongoose from 'mongoose';

const { Schema } = mongoose;

const savedJobSchema = new Schema({
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
  savedAt: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    trim: true,
    maxLength: [500, 'Notes cannot exceed 500 characters'],
  },
});

savedJobSchema.index({ candidate: 1, job: 1 }, { unique: true });
savedJobSchema.index({ candidate: 1, savedAt: -1 });

const SavedJob = mongoose.model('SavedJob', savedJobSchema);

export default SavedJob;
