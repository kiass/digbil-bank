module.exports.updatedAt = function updatedAtPlugin (schema, options) {
  schema.add({ lastMod: Date })
  
  schema.pre('save', function (next) {
    this.updated_at = new Date;
    
    if( !this.created_at ) {
    	this.created_at = this.updated_at;
    }
    
    next();
  });
  
  if (options && options.index) {
    schema.path('updated_at').index(options.index);
  }
}
