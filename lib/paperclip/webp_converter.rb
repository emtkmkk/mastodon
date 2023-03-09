# frozen_string_literal: true

module Paperclip
  class WebPConverter < Paperclip::Processor
    def make
      dst_name = "#{File.basename(file.path, '.*')}.webp"
      dst_type = 'image/webp'

      attachment.instance_write :file_name,    dst_name
      attachment.instance_write :content_type, dst_type

      dst = Paperclip::TempfileFactory.new.generate(dst_name)
      convert(':src :dst', src: File.expand_path(file.path), dst: File.expand_path(dst.path))

      dst
    end
  end
end
