require 'open-uri'
require 'rest-client'

module Commands

  def chain_certs(domain)
    # Keeping it for backward compatibility
    system "/usr/bin/test ! -e #{domain.chained_cert_path} && ln -s #{domain.signed_cert_path} #{domain.chained_cert_path}"
  end

  def mkdir(domain)
    system "/bin/mkdir -p #{domain.dir}"
  end

  def add_dockerhost_to_hosts
    docker_host_ip = `/sbin/ip route|awk '/default/ { print $3 }'`.strip

    File.open('/etc/hosts', 'a') do |f|
      f.puts "#{docker_host_ip}\tdockerhost"
    end
  end

  def generate_ht_access(domains)
    domains.each do |domain|
      if domain.basic_auth_enabled?
        system "/usr/bin/htpasswd -bc #{domain.htaccess_path} #{domain.basic_auth_username} #{domain.basic_auth_password}"
      end
    end
  end

  def ensure_dummy_certificate_for_default_server
    base_dir = File.join(NAConfig.portal_base_dir, "default_server")
    cert_path = File.join(NAConfig.portal_base_dir, "default_server/default_server.crt")
    key_path = File.join(NAConfig.portal_base_dir, "default_server/default_server.key")

    unless File.exist?(cert_path) && File.exist?(key_path)
      OpenSSL.generate_dummy_certificate(
        base_dir,
        cert_path,
        key_path
      )
    end
  end

  def self.dappnode_domain_once
    response = RestClient.get(ENV['DAPPMANAGER_DOMAIN'])
    return response.to_str if response.code == 200

    nil
  rescue => e
    puts e
    nil
  end

  def get_dappnode_domain
    fulldomain_path = ENV['FULLDOMAIN_PATH'] 
    return File.read(fulldomain_path, encoding: 'utf-8') if File.exist?(fulldomain_path)

    puts 'Trying to determine DAppNode domain..'

    30.times do
      domain = dappnode_domain_once
      unless domain.nil?
        File.write(fulldomain_path, domain, encoding: 'utf-8')
        puts ' OK'
        return domain
      end
      puts '.'
      sleep 1
    end
    raise('Could not determine domain')
  rescue => e
    puts 'An error occured during API call to DAPPMANAGER determine DAppNode domain'
    puts e
    exit
  end
end
