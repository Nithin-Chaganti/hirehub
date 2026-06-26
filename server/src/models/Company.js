import mongoose from 'mongoose';

const { Schema } = mongoose;

const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

const companySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Company description cannot exceed 1000 characters'],
    },
    website: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          return !value || URL_REGEX.test(value);
        },
        message: 'Company website must be a valid URL',
      },
    },
    logo: {
      url: String,
      publicId: String,
    },  
    location: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Company owner is required'],
    },
  },
  { timestamps: true }
);

companySchema.index({ createdBy: 1 });
companySchema.index({ name: 1 });

const Company = mongoose.model('Company', companySchema);

export default Company;
