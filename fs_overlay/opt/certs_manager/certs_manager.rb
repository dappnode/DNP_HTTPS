Dir[File.dirname(__FILE__) + '/lib/*.rb'].each { |file| require file }
require_relative 'models/domain'

class CertsManager
  include Commands

  attr_accessor :lock

  def setup
    add_dockerhost_to_hosts
    ensure_crontab

    NAConfig.domains.each do |domain|
      if NAConfig.debug_mode?
        domain.print_debug_info
      end
      domain.ensure_welcome_page
    end

    system "mkdir -p #{ENV['DOMAINS_DIR']}"

    ensure_dummy_certificate_for_default_server
    # OpenSSL.ensure_dhparam
    OpenSSL.ensure_account_key

    generate_ht_access(NAConfig.domains)

    Nginx.setup
    Nginx.start
    begin
      ensure_signed(NAConfig.domains)
    rescue => e
      warn e
      nil
    end
    
    Nginx.stop
    sleep 1 # Give Nginx some time to shutdown
  end

  def renew
    puts "Renewing ..."
    NAConfig.domains.each(&:print_debug_info) if NAConfig.debug_mode?
    with_lock do
      NAConfig.domains.each do |domain|
        if NAConfig.debug_mode?
          domain.print_debug_info
        end

        if OpenSSL.need_to_sign_or_renew? domain
          ACME.sign(domain)
          chain_certs(domain)
          Nginx.reload
          puts "Renewed certs for #{domain.name}"
        else
          puts "Renewal skipped for #{domain.name}, it expires at #{OpenSSL.expires_in_days(domain.signed_cert_path)} days from now."
        end
      end
    end
    puts "Renewal done."
  end

  def reconfig
    domains = NAConfig.auto_discovered_domains
    names = domains.map(&:name)
    Dir.foreach('/etc/nginx/conf.d') do |filename|
      next if filename == '.' or filename == '..'

      ident = filename.include?('ssl') ? filename.delete_suffix('.ssl.conf') : filename.delete_suffix('.conf')
      unless names.include? ident
        puts "Deleting old #{filename} configuration..."
        system "/bin/rm /etc/nginx/conf.d/#{filename}"
      end
    end
    ensure_signed(domains)
  rescue => e
    warn e
    exit 1
  end

  private

  def ensure_signed(domains)
    with_lock do
      domains.each do |domain|
        Nginx.config_http(domain)

        if OpenSSL.need_to_sign_or_renew? domain
          mkdir(domain)
          OpenSSL.ensure_domain_key(domain)
          OpenSSL.create_csr(domain)
          if ACME.sign(domain)
            chain_certs(domain)
            Nginx.config_ssl(domain)
            puts "Signed key for #{domain.name}"
          else
            puts("Failed to obtain certs for #{domain.name}")
          end
        else
          Nginx.config_ssl(domain)
          puts "Signing skipped for #{domain.name}, it expires at #{OpenSSL.expires_in_days(domain.signed_cert_path)} days from now."
        end
      end
    end
  end

  def with_lock(&block)
    File.open('/tmp/https-portal.lock', File::CREAT) do |lock|
      lock.flock File::LOCK_EX
      yield(block)
    end
  end

  def ensure_crontab
    crontab = '/etc/crontab'

    unless File.exist?(crontab)
      File.open(crontab, 'w') do |file|
        file.write compiled_crontab
      end
    end
  end

  def compiled_crontab
    ERBBinding.new('/var/lib/crontab.erb', {}).compile
  end
end
